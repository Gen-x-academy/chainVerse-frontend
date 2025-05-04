interface StepIndicatorProps {
  currentStep: number;
  totalSteps: number;
}

export function StepIndicator({ currentStep, totalSteps }: StepIndicatorProps) {
  return (
    <div className="flex items-center justify-center my-8">
      {Array.from({ length: totalSteps }).map((_, index) => (
        <div key={index} className="flex items-center">
          {index > 0 && (
            <div
              className={`w-8 h-[1px] ${
                index + 1 <= currentStep
                  ? "bg-primary"
                  : "bg-primary-foreground"
              } `}
            />
          )}
          <div
            className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
              index + 1 === currentStep
                ? "bg-primary text-primary-foreground"
                : index + 1 < currentStep
                ? "bg-primary text-primary-foreground"
                : " border-2 border-primary-foreground text-muted-foreground"
            }`}
          >
            {index + 1}
          </div>
        </div>
      ))}
      <div className="ml-auto text-sm text-muted-foreground">
        Step {currentStep} of {totalSteps}
      </div>
    </div>
  );
}
