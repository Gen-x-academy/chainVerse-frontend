import { useState } from "react";
import React from "react";
import { validate } from "./validate";

const FormWrapper = ({
  initialValues,
  validationRules,
  onSubmit,
  children,
}) => {
  const [values, setValues] = useState(initialValues || {});
  const [errors, setErrors] = useState({});

  const handleChange = (e) => {
    const { name, value } = e.target;

    setValues((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    const validationErrors = validate(values, validationRules || {});
    setErrors(validationErrors);

    if (Object.keys(validationErrors).length === 0) {
      onSubmit(values);
    }
  };

  const enhancedChildren = React.Children.map(children, (child) => {
    if (!child.props?.name) return child;

    return React.cloneElement(child, {
      value: values[child.props.name] || "",
      onChange: handleChange,
      error: errors[child.props.name], // pass error
    });
  });

  return <form onSubmit={handleSubmit}>{enhancedChildren}</form>;
};

export default FormWrapper;