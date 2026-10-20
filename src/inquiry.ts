import { sampleData } from './sampleData.ts';

export interface InquiryValues {
  company: string;
  email: string;
  destination: string;
  product: string;
  quantityKg: string;
  packaging: string;
  terms: string;
  questions: string;
}
export type InquiryErrors = Partial<Record<keyof InquiryValues, string>>;

// Shared by the demo form and focused validation tests. No network or persistence.
export function validateInquiry(values: InquiryValues): InquiryErrors {
  const errors: InquiryErrors = {};
  if (values.company.trim().length < 2 || values.company.length > 120) errors.company = 'Enter a buyer or company name of 2–120 characters.';
  if (values.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) errors.email = 'Enter a valid contact email address.';
  if (!sampleData.inquiry.destinations.includes(values.destination)) errors.destination = 'Select a destination market.';
  if (!sampleData.inquiry.products.includes(values.product)) errors.product = 'Select the sample product.';
  const quantity = Number(values.quantityKg);
  const grams = quantity * 1000;
  if (!values.quantityKg.trim() || !Number.isFinite(quantity) || quantity < 0.001 || !Number.isSafeInteger(Math.round(grams)) || Math.abs(grams - Math.round(grams)) > 0.000001) errors.quantityKg = 'Enter at least 0.001 kg, with up to three decimal places.';
  if (!sampleData.inquiry.terms.includes(values.terms)) errors.terms = 'Select preferred delivery terms.';
  if (values.packaging.length > 1000) errors.packaging = 'Keep packaging requirements to 1,000 characters.';
  if (values.questions.length > 2000) errors.questions = 'Keep questions to 2,000 characters.';
  return errors;
}
