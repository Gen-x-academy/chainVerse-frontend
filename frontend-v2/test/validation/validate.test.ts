import { validate } from "@/utils/validation/validate";
import { validators } from "@/utils/validation/validators";

describe("Form Validation", () => {
  test("returns errors for invalid fields", () => {
    const values = { email: "", password: "123" };

    const rules = {
      email: [validators.required],
      password: [validators.minLength(6)],
    };

    const errors = validate(values, rules);

    expect(errors.email).toBe("This field is required");
    expect(errors.password).toBe("Must be at least 6 characters");
  });

  test("returns no errors when valid", () => {
    const values = { email: "test@mail.com", password: "123456" };

    const rules = {
      email: [validators.required, validators.email],
      password: [validators.minLength(6)],
    };

    const errors = validate(values, rules);

    expect(errors).toEqual({});
  });
});