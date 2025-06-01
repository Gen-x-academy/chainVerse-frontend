import { InstructorProps } from "@/types";
import React from "react";

const Main = ({ user }: { user: InstructorProps }) => {
  return (
    <div className="p-4">
      <h2>Good day, {user.name.split(" ")[0]}</h2>
    </div>
  );
};

export default Main;
