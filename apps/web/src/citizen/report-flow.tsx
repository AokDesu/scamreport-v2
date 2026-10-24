import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { Controller, useForm, useWatch, type FieldPath, type UseFormReturn } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate, useSearchParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import * as RadioGroupPrimitive from '@radix-ui/react-radio-group';
import { ArrowRight, Check, FileText, ImagePlus, Mail, Phone, Send, TriangleAlert, X } from 'lucide-react';
import type { Me, Report, Tenant } from '@scamreport/shared';
import { cn } from '@/lib/utils';
import { api, ApiFailure, failureMessageKey } from '@/lib/api';
import { drafts, type Draft } from '@/lib/draft';
import { orgName } from '@/lib/format';
import { channelIcon, channels, evidenceTypes, maxEvidenceBytes, maxEvidenceFiles, scamTypeIcon, scamTypes } from '@/lib/domain';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { RadioGroup } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { OrgMark } from '@/components/brand';
import { BottomActions, CitizenBody, CitizenHeader } from './shell';
import { Skeleton } from '@/components/ui/skeleton';
import i18n from '@/i18n';
import { detailFields, emptyReport, reportSchema, toReportInput, type ReportValues } from './report-schema';

type Step = 'details' | 'consent';

function Section({ title, titleId, children, className }: { title?: ReactNode; titleId?: string; children: ReactNode; className?: string }) {
  return (
    <section aria-labelledby={titleId} className={cn('flex flex-col gap-4 rounded-xl bg-card p-5 shadow-sm', className)}>
      {title && <h2 id={titleId} className="font-heading text-[1.0625rem] leading-[1.4] font-semibold">{title}</h2>}
      {children}
    </section>
  );
}

function FieldError({ id, message }: { id: string; message?: string }) {
  const { t } = useTranslation();
  if (!message) return null;
  return <p id={id} data-error className="flex items-start gap-1.5 text-base font-medium text-destructive"><TriangleAlert aria-hidden="true" className="mt-1 size-4.5 flex-none" />{t(message)}</p>;
}

/** Choice tile: a radio rendered as a card (scam type, destination, consent). */
function ChoiceTile({ value, children, className }: { value: string; children: ReactNode; className?: string }) {
  return (
    <RadioGroupPrimitive.Item value={value} className={cn(
      'group relative flex cursor-pointer flex-col items-start gap-1.5 rounded-lg bg-card text-left font-heading font-medium shadow-[inset_0_0_0_1.5px_var(--border)] transition-[box-shadow,background-color]',
      'data-[state=checked]:bg-[#ecf8f3] data-[state=checked]:shadow-[inset_0_0_0_2.5px_var(--primary)] aria-invalid:shadow-[inset_0_0_0_1.5px_var(--destructive)]', className)}>
      {children}
    </RadioGroupPrimitive.Item>
  );
}
function TileCheck() {
  return (
    <span aria-hidden="true" className="absolute top-2.5 right-2.5 hidden size-5.5 place-items-center rounded-full bg-primary text-primary-foreground group-data-[state=checked]:grid">
      <Check className="size-3.5" strokeWidth={3.5} />
    </span>
  );
}

function EvidencePicker({ files, onChange }: { files: File[]; onChange: (files: File[]) => void }) {
  const { t } = useTranslation();
  const inputId = useId();
  const previews = useMemo(() => files.map(file => file.type.startsWith('image/') ? URL.createObjectURL(file) : null), [files]);
  useEffect(() => () => previews.forEach(url => url && URL.revokeObjectURL(url)), [previews]);
  function add(list: FileList | null) {
    const next = [...files];
    for (const file of Array.from(list ?? [])) {
      if (next.length >= maxEvidenceFiles) { toast.error(t('report.photoLimitReached', { count: maxEvidenceFiles })); break; }
      if (!evidenceTypes.includes(file.type)) toast.error(t('report.photoWrongType', { name: file.name }));
      else if (file.size > maxEvidenceBytes) toast.error(t('report.photoTooBig', { name: file.name }));
      else next.push(file);
    }
    onChange(next);
  }
  return (
    <div className="flex flex-wrap gap-2.5">
      {files.map((file, index) => (
        <figure key={`${file.name}-${file.size}-${index}`} className="relative m-0 h-33 w-26 overflow-hidden rounded-md bg-muted shadow-[inset_0_0_0_1px_var(--border)]">
          {previews[index]
            ? <img src={previews[index]!} alt={file.name} className="size-full object-cover" />
            : <span className="flex size-full flex-col items-center justify-center gap-1 p-2 text-center text-xs break-all text-muted-foreground"><FileText aria-hidden="true" className="size-7" />{file.name}</span>}
          <button type="button" aria-label={t('report.removePhoto', { name: file.name })} onClick={() => onChange(files.filter((_, at) => at !== index))}
            className="absolute top-1 right-1 grid size-11 cursor-pointer place-items-center rounded-full bg-[rgb(15_31_29/0.72)] text-white">
            <X aria-hidden="true" className="size-4.5" />
          </button>
        </figure>
      ))}
      {files.length < maxEvidenceFiles && (
        <>
          <input id={inputId} type="file" accept={evidenceTypes.join(',')} multiple className="peer sr-only" onChange={event => { add(event.target.files); event.target.value = ''; }} />
          <label htmlFor={inputId} className="flex h-33 w-26 cursor-pointer flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed border-input bg-card text-center font-heading text-[0.9375rem] leading-[1.3] font-semibold text-primary peer-focus-visible:outline-3 peer-focus-visible:outline-ring">
            <ImagePlus aria-hidden="true" className="size-7" />{t('report.addPhoto')}
          </label>
        </>
      )}
    </div>
  );
}

function DetailsStep({ form, files, setFiles }: { form: UseFormReturn<ReportValues>; files: File[]; setFiles: (files: File[]) => void }) {
  const { t } = useTranslation();
  const { control, register, formState: { errors } } = form;
  const noLoss = useWatch({ control, name: 'no_loss' });
  return (
    <>
      <div className="flex items-start gap-3 rounded-lg bg-signal-soft p-4 text-base leading-[1.6] text-signal-foreground">
        <TriangleAlert aria-hidden="true" className="mt-0.5 size-5 flex-none" />
        <p>{t('report.urgent')}</p>
      </div>
      <Section title={t('report.typeLabel')} titleId="type-label">
        <Controller control={control} name="scam_type" render={({ field }) => (
          <RadioGroup aria-labelledby="type-label" aria-describedby={errors.scam_type ? 'type-error' : undefined} aria-invalid={Boolean(errors.scam_type)}
            value={field.value ?? ''} onValueChange={field.onChange} className="grid grid-cols-2 gap-2.5" data-invalid={Boolean(errors.scam_type) || undefined}>
            {scamTypes.map(type => {
              const Icon = scamTypeIcon[type];
              return (
                <ChoiceTile key={type} value={type} className="min-h-21 px-3.5 pt-3.5 pb-3 text-base leading-[1.4]">
                  <Icon aria-hidden="true" className="size-6.5 text-primary" />{t(`scamType.${type}`)}<TileCheck />
                </ChoiceTile>
              );
            })}
          </RadioGroup>
        )} />
        <FieldError id="type-error" message={errors.scam_type?.message} />
      </Section>
      <Section title={t('report.channelLabel')} titleId="channel-label">
        <Controller control={control} name="channel" render={({ field }) => (
          <ToggleGroup type="single" aria-labelledby="channel-label" aria-describedby={errors.channel ? 'channel-error' : undefined}
            value={field.value ?? ''} onValueChange={value => value && field.onChange(value)} className="flex w-full flex-wrap gap-2" spacing={2}
            data-invalid={Boolean(errors.channel) || undefined}>
            {channels.map(channel => {
              const Icon = channelIcon[channel];
              return (
                <ToggleGroupItem key={channel} value={channel}
                  className="min-h-12 cursor-pointer rounded-full bg-card px-4 font-heading text-base font-medium text-foreground shadow-[inset_0_0_0_1.5px_var(--border)] hover:bg-muted data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:shadow-none">
                  <Icon aria-hidden="true" className="size-4.5" />{t(`channel.${channel}`)}
                </ToggleGroupItem>
              );
            })}
          </ToggleGroup>
        )} />
        <FieldError id="channel-error" message={errors.channel?.message} />
      </Section>
      <Section>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="amount">{t('report.amountLabel')}</Label>
          <div className="relative flex items-center">
            <span aria-hidden="true" className="absolute left-4 font-semibold text-muted-foreground">฿</span>
            <Input id="amount" inputMode="decimal" autoComplete="off" placeholder={t('report.amountPlaceholder')} disabled={noLoss} className="pl-9 tabular-nums"
              aria-invalid={Boolean(errors.amount)} aria-describedby={errors.amount ? 'amount-error' : undefined} {...register('amount')} />
          </div>
          <FieldError id="amount-error" message={errors.amount?.message} />
          <Controller control={control} name="no_loss" render={({ field }) => (
            <div className="mt-1 flex min-h-12 items-center gap-3">
              <Checkbox id="no-loss" checked={field.value} onCheckedChange={checked => { field.onChange(checked === true); if (checked) form.clearErrors('amount'); }} />
              <Label htmlFor="no-loss" className="cursor-pointer font-sans text-base font-normal">{t('report.noLoss')}</Label>
            </div>
          )} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="story">{t('report.storyLabel')}</Label>
          <Textarea id="story" rows={4} placeholder={t('report.storyPlaceholder')} aria-invalid={Boolean(errors.description)}
            aria-describedby={errors.description ? 'story-error story-hint' : 'story-hint'} {...register('description')} />
          <p id="story-hint" className="text-[0.9375rem] leading-[1.55] text-muted-foreground">{t('report.storyHint')}</p>
          <FieldError id="story-error" message={errors.description?.message} />
        </div>
      </Section>
      <Section title={<>{t('report.photosLabel')} <span className="font-sans text-[0.9375rem] font-normal text-muted-foreground">{t('report.photosLimit', { count: maxEvidenceFiles })}</span></>} titleId="photos-label">
        <p className="-mt-2 text-[0.9375rem] leading-[1.55] text-muted-foreground">{t('report.photosHint')}</p>
        <EvidencePicker files={files} onChange={setFiles} />
      </Section>
    </>
  );
}

function ConsentStep({ form }: { form: UseFormReturn<ReportValues> }) {
  const { t, i18n } = useTranslation();
  const { control, register, setValue, getValues, formState: { errors } } = form;
  const tenants = useQuery({ queryKey: ['tenants'], queryFn: () => api<Tenant[]>('/tenants') });
  useEffect(() => {
    if (tenants.data?.length === 1 && !getValues('organization_id')) setValue('organization_id', tenants.data[0]!.id);
  }, [tenants.data, getValues, setValue]);
  return (
    <>
      <Section title={t('report.destinationLabel')} titleId="destination-label">
        <p className="-mt-2 text-[0.9375rem] leading-[1.55] text-muted-foreground">{t('report.destinationHint')}</p>
        {tenants.isError && <p role="alert" className="text-base text-destructive">{t('errors.network')}</p>}
        <Controller control={control} name="organization_id" render={({ field }) => (
          <RadioGroup aria-labelledby="destination-label" aria-describedby={errors.organization_id ? 'destination-error' : undefined}
            value={field.value ?? ''} onValueChange={field.onChange} className="flex flex-col gap-2.5" data-invalid={Boolean(errors.organization_id) || undefined}>
            {(tenants.data ?? []).map(tenant => (
              <ChoiceTile key={tenant.id} value={tenant.id} className="flex-row items-center gap-3.5 bg-muted p-4 pr-10 data-[state=checked]:bg-[#ecf8f3]">
                <OrgMark name={orgName(tenant.name, i18n.language)} id={tenant.id} />
                <span className="text-lg leading-[1.4] font-semibold">{orgName(tenant.name, i18n.language)}</span>
                <TileCheck />
              </ChoiceTile>
            ))}
          </RadioGroup>
        )} />
        <FieldError id="destination-error" message={errors.organization_id?.message} />
        <h3 className="mt-1 font-heading text-base font-medium text-foreground">{t('report.shareTitle')}</h3>
        <div className="flex flex-col">
          <div className="flex items-center gap-3 border-b border-border py-2">
            <Mail aria-hidden="true" className="size-5 flex-none text-primary" />
            <Label htmlFor="contact-email" className="w-24 flex-none font-sans text-[0.9375rem] font-normal text-muted-foreground">{t('report.shareEmail')}</Label>
            <Input id="contact-email" type="email" autoComplete="email" className="h-12 text-base"
              aria-invalid={Boolean(errors.contact_email)} aria-describedby={errors.contact_email ? 'contact-error' : undefined} {...register('contact_email')} />
          </div>
          <div className="flex items-center gap-3 py-2">
            <Phone aria-hidden="true" className="size-5 flex-none text-primary" />
            <Label htmlFor="contact-phone" className="w-24 flex-none font-sans text-[0.9375rem] font-normal text-muted-foreground">{t('report.sharePhone')}</Label>
            <Input id="contact-phone" type="tel" autoComplete="tel" inputMode="tel" className="h-12 text-base" placeholder={t('report.sharePhonePlaceholder')}
              aria-invalid={Boolean(errors.contact_phone)} aria-describedby={errors.contact_phone ? 'phone-error' : undefined} {...register('contact_phone')} />
          </div>
          <FieldError id="contact-error" message={errors.contact_email?.message} />
          <FieldError id="phone-error" message={errors.contact_phone?.message} />
        </div>
        <p className="text-[0.9375rem] leading-[1.55] text-muted-foreground">{t('report.shareNever')}</p>
      </Section>
      <Controller control={control} name="consent" render={({ field }) => (
        <RadioGroup aria-label={t('report.consentLegend')} aria-describedby={errors.consent ? 'consent-error' : undefined}
          value={field.value ?? ''} onValueChange={field.onChange} className="flex flex-col gap-2.5" data-invalid={Boolean(errors.consent) || undefined}>
          {(['yes', 'no'] as const).map(choice => (
            <ChoiceTile key={choice} value={choice} className="flex-row items-start gap-3.5 px-4.5 py-4">
              <span aria-hidden="true" className="mt-0.5 size-6.5 flex-none rounded-full bg-card shadow-[inset_0_0_0_2px_var(--input)] group-data-[state=checked]:shadow-[inset_0_0_0_7px_var(--primary)]" />
              <span className="flex flex-col">
                <span className="text-lg leading-[1.4] font-semibold">{t(choice === 'yes' ? 'report.consentYes' : 'report.consentNo')}</span>
                <span className="mt-0.5 font-sans text-[0.9375rem] leading-[1.55] font-normal text-muted-foreground">{t(choice === 'yes' ? 'report.consentYesHint' : 'report.consentNoHint')}</span>
              </span>
            </ChoiceTile>
          ))}
        </RadioGroup>
      )} />
      <FieldError id="consent-error" message={errors.consent?.message} />
      <p className="px-1 text-[0.9375rem] text-muted-foreground">{t('report.withdrawHint')}</p>
    </>
  );
}

const draftFields = ['scam_type', 'channel', 'amount', 'no_loss', 'description', 'organization_id', 'consent', 'contact_email', 'contact_phone'] as const;

/** Two-step report: what happened, then destination and consent. The draft autosaves to this device. */
export function ReportFlow({ me }: { me: Me }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const step: Step = params.get('step') === 'consent' ? 'consent' : 'details';
  const form = useForm<ReportValues>({ resolver: zodResolver(reportSchema), defaultValues: { ...emptyReport, contact_email: me.email ?? '' }, mode: 'onTouched' });
  const [files, setFiles] = useState<File[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [sent, setSent] = useState<Draft['sent']>();
  const [progress, setProgress] = useState<string | null>(null);
  const [failure, setFailure] = useState<ApiFailure | Error | null>(null);
  const values = useWatch({ control: form.control });
  const formRef = useRef<HTMLFormElement>(null);
  const autosave = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const busy = useRef(false);
  const { reset, getValues } = form;

  useEffect(() => {
    let active = true;
    void drafts.load(me.id).then(draft => {
      if (!active) return;
      if (draft) {
        reset({ ...getValues(), ...Object.fromEntries(draftFields.filter(key => draft[key] !== undefined).map(key => [key, draft[key]])) });
        setFiles(draft.files ?? []);
        setSent(draft.sent);
        toast(i18n.t('report.draftRestored'));
      }
      setLoaded(true);
    }).catch(error => { if (active) setFailure(error); });
    return () => { active = false; };
  }, [me.id, reset, getValues]);

  useEffect(() => {
    if (!loaded) return;
    // While a submit runs it owns the draft, so a pending autosave can never undo its saves or its final removal.
    if (progress || busy.current) return;
    const started = Boolean(values.scam_type || values.channel || values.amount || values.description || files.length);
    autosave.current = setTimeout(() => {
      if (!started || busy.current) return;
      const draft: Draft = { ...Object.fromEntries(draftFields.map(key => [key, values[key]])), files, step, sent };
      void drafts.save(me.id, draft).catch(setFailure);
    }, 400);
    return () => clearTimeout(autosave.current);
  }, [values, files, step, sent, progress, loaded, me.id]);

  function focusFirstError() {
    requestAnimationFrame(() => {
      const target = formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"], [data-invalid] [role="radio"], [data-invalid] button');
      target?.focus();
      target?.scrollIntoView({ block: 'center' });
    });
  }

  // Older users often double-click: ignore a second submit that lands just after moving to step 2.
  const consentSince = useRef(0);
  async function next() {
    if (busy.current || !loaded) return;
    const ok = sent || await form.trigger(detailFields as unknown as FieldPath<ReportValues>[]);
    if (!ok) return focusFirstError();
    consentSince.current = Date.now();
    setParams({ step: 'consent' });
    window.scrollTo(0, 0);
  }

  async function startOver() {
    if (busy.current) return;
    busy.current = true;
    clearTimeout(autosave.current);
    setProgress(t('app.loading'));
    setFailure(null);
    try {
      await drafts.remove(me.id);
      reset({ ...emptyReport, contact_email: me.email ?? '' });
      setFiles([]);
      setSent(undefined);
      setParams({ step: 'details' });
      window.scrollTo(0, 0);
    } catch (error) { setFailure(error as Error); }
    finally { busy.current = false; setProgress(null); }
  }

  async function submit(valid: ReportValues) {
    if (busy.current || !loaded) return;
    busy.current = true;
    clearTimeout(autosave.current);
    setFailure(null);
    setProgress(t('report.submitting'));
    // The draft is the record of progress: it keeps the created report's ID and every file not yet
    // uploaded, so an expiry or a failed upload is retried onto the same report, never a duplicate.
    const keep = (progressNow: Draft['sent'], left: File[]) => drafts.save(me.id, { ...Object.fromEntries(draftFields.map(key => [key, valid[key]])), files: left, step, sent: progressNow } as Draft);
    try {
      let report: Report | undefined;
      let progressNow = sent;
      await keep(progressNow, files);
      if (!progressNow) {
        report = await api<Report>('/reports', { method: 'POST', body: JSON.stringify(toReportInput(valid)) });
        progressNow = { reportId: report.id, attached: 0 };
        setSent(progressNow);
        await keep(progressNow, files);
      }
      let left = files;
      for (const file of files) {
        setProgress(t('report.uploading', { done: progressNow.attached + 1, total: progressNow.attached + left.length }));
        const body = new FormData();
        body.set('file', file);
        try {
          await api(`/reports/${progressNow.reportId}/evidence`, { method: 'POST', body });
        } catch (error) {
          if (error instanceof ApiFailure && error.status === 401) return;
          continue;
        }
        left = left.filter(other => other !== file);
        progressNow = { ...progressNow, attached: progressNow.attached + 1 };
        setFiles(left);
        setSent(progressNow);
        await keep(progressNow, left);
      }
      if (left.length) {
        toast.error(t('report.uploadFailed', { count: left.length }));
        setProgress(null);
        busy.current = false;
        return;
      }
      await drafts.remove(me.id);
      navigate(`/citizen/report/received/${progressNow.reportId}`, { replace: true, state: { report, attached: progressNow.attached } });
    } catch (error) {
      if (error instanceof ApiFailure && error.status === 403) navigate('/unauthorized', { state: { need: 'citizen', requestId: error.requestId } });
      else setFailure(error as Error);
      setProgress(null);
      busy.current = false;
    }
  }

  return (
    <>
      <CitizenHeader overlap={false} title={t(step === 'details' ? 'report.title' : 'report.consentTitle')}
        back={step === 'details' ? { to: '/citizen/feed' } : { to: '/citizen/report' }}
        subtitle={
          <div className="mt-2 flex items-center gap-2 font-heading text-[0.9375rem] font-medium">
            <span>{t(step === 'details' ? 'report.step1' : 'report.step2')}</span>
            <Progress value={step === 'details' ? 50 : 100} aria-label={t('report.progress')} className="flex-1" />
          </div>
        } />
      <CitizenBody overlap={false}>
        <form ref={formRef} noValidate className="flex flex-col gap-4" onSubmit={event => {
          event.preventDefault();
          if (step === 'details') void next();
          else if (Date.now() - consentSince.current > 800) {
            if (sent) void submit(getValues());
            else void form.handleSubmit(submit, focusFirstError)(event);
          }
        }}>
          {sent && (
            <section aria-labelledby="sent-title" className="flex flex-col gap-3 rounded-xl bg-signal-soft p-4 text-signal-foreground">
              <h2 id="sent-title" className="font-heading text-[1.0625rem] font-semibold">{t('report.sentTitle')}</h2>
              <p className="text-base leading-[1.6]">{t('report.sentNote')}</p>
              <Button type="button" variant="outline" disabled={Boolean(progress)} onClick={() => void startOver()}>{t('report.startOver')}</Button>
            </section>
          )}
          {/* The saved draft loads first, so it can never overwrite answers typed meanwhile. */}
          {!loaded ? !failure && <Skeleton role="status" aria-label={t('app.loading')} className="h-96 rounded-xl bg-card" />
            : step === 'details' ? <DetailsStep form={form} files={files} setFiles={setFiles} />
            : <ConsentStep form={form} />}
          {failure && (
            <p role="alert" className="rounded-md bg-danger-soft px-4 py-3 text-base text-danger-soft-foreground">
              {t(failureMessageKey(failure))}
              {!loaded && <Button type="button" variant="link" onClick={() => window.location.reload()}>{t('app.retry')}</Button>}
              {failure instanceof ApiFailure && <span className="mt-1 block font-[Noto_Sans] text-sm tabular-nums">{t('errors.reference', { id: failure.requestId })}</span>}
            </p>
          )}
          <BottomActions>
            {progress && <p role="status" className="text-center text-base text-muted-foreground">{progress}</p>}
            <Button type="submit" size="lg" disabled={!loaded || Boolean(progress)}>
              {step === 'details' ? <>{t('report.next')}<ArrowRight aria-hidden="true" /></> : <><Send aria-hidden="true" />{t(sent ? 'report.retryUpload' : 'report.submit')}</>}
            </Button>
          </BottomActions>
        </form>
      </CitizenBody>
    </>
  );
}
