export const asyncValidators = {
  checkEmailExists: async (value) => {
    if (!value) return null;

    try {
      const res = await fetch(`/api/check-email?email=${value}`);
      const data = await res.json();

      if (data.exists) {
        return "Email already exists";
      }

      return null;
    } catch (err) {
      return "Error validating email";
    }
  },

  checkUsernameExists: async (value) => {
    try {
      const res = await fetch(`/api/check-username?username=${value}`);
      const data = await res.json();

      if (data.exists) {
        return "Username already taken";
      }

      return null;
    } catch (err) {
      return "Error validating username";
    }
  },
};