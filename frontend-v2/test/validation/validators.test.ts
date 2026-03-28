import { validators } from "@/utils/validation/validators";

describe("Validation Helpers", () => {
  test("required validator", () => {
    expect(validators.required("")).toBe("This field is required");
    expect(validators.required("text")).toBeNull();
  });

  test("email validator", () => {
    expect(validators.email("wrong")).toBe("Invalid email address");
    expect(validators.email("test@mail.com")).toBeNull();
  });
});