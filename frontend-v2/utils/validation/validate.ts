type Validator = (value: string) => string | null;
type Rules = Record<string, Validator[]>;
type Values = Record<string, string>;
type Errors = Record<string, string>;

export function validate(values: Values, rules: Rules): Errors {
  const errors: Errors = {};
  for (const field of Object.keys(rules)) {
    for (const validator of rules[field]) {
      const error = validator(values[field] ?? '');
      if (error) {
        errors[field] = error;
        break;
      }
    }
  }
  return errors;
}
