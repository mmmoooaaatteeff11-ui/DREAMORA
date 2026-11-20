/** Generic result of a Server Action used with useFormState. */
export type ActionState = {
  status: 'idle' | 'success' | 'error';
  /** i18n key under the form's `errors.*` namespace */
  code?: string;
  /** field name -> i18n key under the form's `errors.*` namespace */
  fieldErrors?: Record<string, string>;
};

export const initialActionState: ActionState = { status: 'idle' };
