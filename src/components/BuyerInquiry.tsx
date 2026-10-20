import { Localized } from '../localization';
import { useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { sampleData as data } from '../sampleData';
import { validateInquiry } from '../inquiry';
import type { InquiryErrors, InquiryValues } from '../inquiry';

export function BuyerInquiry() {
  const [errors, setErrors] = useState<InquiryErrors>({});
  const [preview, setPreview] = useState<InquiryValues | null>(null);
  const confirmation = useRef<HTMLDivElement>(null);
  const form = useRef<HTMLFormElement>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const read = (key: keyof InquiryValues) => String(formData.get(key) ?? '').trim();
    const values: InquiryValues = { company: read('company'), email: read('email'), destination: read('destination'), product: read('product'), quantityKg: read('quantityKg'), packaging: read('packaging'), terms: read('terms'), questions: read('questions') };
    const nextErrors = validateInquiry(values);
    setErrors(nextErrors);
    setPreview(null);
    const firstError = Object.keys(nextErrors)[0];
    if (firstError) {
      const field = event.currentTarget.elements.namedItem(firstError);
      if (field instanceof HTMLElement) field.focus();
      return;
    }
    setPreview(values);
    requestAnimationFrame(() => confirmation.current?.focus());
  }

  function errorProps(name: keyof InquiryValues) {
    return { 'aria-invalid': Boolean(errors[name]), 'aria-describedby': errors[name] ? `${name}-error` : undefined };
  }
  const error = (name: keyof InquiryValues) => errors[name] ? <small id={`${name}-error`} className="field-error">{errors[name]}</small> : null;

  return <Localized><section id="contact" className="business-section inquiry-section" aria-labelledby="inquiry-heading"><div className="business-heading"><div><p className="eyebrow">INTERESTED IN THIS SUPPLY?</p><h2 id="inquiry-heading">Request producer information.</h2></div><p>Explore an inquiry from the buyer’s perspective. No backend or email service is connected.</p></div><div className="inquiry-layout panel"><aside className="inquiry-intro"><span className="badge">DEMO ONLY · NOTHING SENT</span><h3>Your requirements,<br/>in one place.</h3><p>Use the sample listing to explore quantity, packaging, destination, and commercial terms.</p><ul><li>Client-side validation and a local preview</li><li>No message, quotation, or booking is created</li><li>No inquiry is saved; reloading clears the form</li></ul><div className="contact-identity"><strong>{data.contact.name}</strong><p>{data.contact.status}</p><p>{data.contact.quote}</p></div></aside>
      <form ref={form} onSubmit={handleSubmit} noValidate onChange={() => { if (preview) setPreview(null); }} onReset={() => { setErrors({}); setPreview(null); }} aria-describedby="form-notice">
        <p id="form-notice" className="form-notice">Prototype form · This only creates an on-screen preview. Nothing is sent or stored. Fields marked * are required.</p>
        <div className="form-grid">
          <label>Company *<input name="company" autoComplete="organization" required minLength={2} maxLength={120} {...errorProps('company')}/>{error('company')}</label>
          <label>Contact email *<input name="email" type="email" autoComplete="email" required maxLength={254} {...errorProps('email')}/>{error('email')}</label>
          <label>Destination *<select name="destination" defaultValue="" required {...errorProps('destination')}><option value="" disabled>Select a market</option>{data.inquiry.destinations.map(value => <option key={value} value={value}>{value}</option>)}</select>{error('destination')}</label>
          <label>Product *<select name="product" defaultValue="" required {...errorProps('product')}><option value="" disabled>Select a product</option>{data.inquiry.products.map(value => <option key={value} value={value}>{value}</option>)}</select>{error('product')}</label>
          <label>Required volume (kg, up to 3 decimals) *<input name="quantityKg" type="number" inputMode="decimal" min="0.001" step="0.001" required {...errorProps('quantityKg')}/>{error('quantityKg')}</label>
          <label>Preferred delivery terms *<select name="terms" defaultValue="" required {...errorProps('terms')}><option value="" disabled>Select preferred terms</option>{data.inquiry.terms.map(value => <option key={value} value={value}>{value}</option>)}</select>{error('terms')}</label>
          <label className="full-width">Packaging requirements<textarea name="packaging" rows={2} maxLength={1000} placeholder={data.inquiry.packagingPlaceholder} {...errorProps('packaging')}/>{error('packaging')}</label>
          <label className="full-width">Message<textarea name="questions" rows={3} maxLength={2000} {...errorProps('questions')}/>{error('questions')}</label>
        </div>
        {Object.keys(errors).length > 0 && <p className="field-error" role="alert">Please correct the highlighted fields. Nothing has been sent.</p>}
        <div className="form-actions"><button className="quote-button" type="submit">Preview demo inquiry ↗</button><button className="reset-inquiry" type="reset">Clear form</button></div>
        {preview && <div ref={confirmation} tabIndex={-1} className="inquiry-confirmation" role="status"><strong>Demo preview only — nothing sent.</strong><p>No inquiry has been delivered to Eduardo or any supplier. No price or shipment is confirmed.</p><dl><div><dt>Buyer / company</dt><dd data-no-translate>{preview.company}</dd></div><div><dt>Email</dt><dd data-no-translate>{preview.email}</dd></div><div><dt>Market / sample product</dt><dd>{preview.destination} · {preview.product}</dd></div><div><dt>Requested quantity</dt><dd>{new Intl.NumberFormat('en-US', { maximumFractionDigits: 3 }).format(Number(preview.quantityKg))} kg</dd></div><div><dt>Preferred terms</dt><dd>{preview.terms}</dd></div>{preview.packaging && <div><dt>Packaging requirements</dt><dd data-no-translate>{preview.packaging}</dd></div>}{preview.questions && <div><dt>Questions</dt><dd data-no-translate>{preview.questions}</dd></div>}</dl></div>}
      </form>
    </div></section></Localized>;
}
