type Validator = (value: string) => string | null;

export const validators = {
  required: (value: string): string | null => {
    if (!value || value.trim() === '') return 'This field is required';
    return null;
  },

  minLength:
    (min: number): Validator =>
    (value: string) => {
      if (value.length < min) return `Must be at least ${min} characters`;
      return null;
    },

  email: (value: string): string | null => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'Invalid email address';
    return null;
  },
};
