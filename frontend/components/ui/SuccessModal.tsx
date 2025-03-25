import { Badge, ChartSpline, Check, Users, Wallet } from "lucide-react";
import { Button } from "./button";
import Link from "next/link";

interface FeatureItemProps {
  Icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  title: string;
  description: string;
}

const FeatureItem = ({ Icon, title, description }: FeatureItemProps) => (
  <div className="flex flex-col items-center text-center space-y-2">
    <div className="bg-slate-200 rounded-full p-2 mb-2">
      <Icon className="w-5 h-5 text-sky-600" />
    </div>
    <h4 className="font-semibold text-gray-800">{title}</h4>
    <p className="text-gray-600 text-sm">{description}</p>
  </div>
);

const SuccessModal = () => {
  const features = [
    {
      Icon: Badge,
      title: "NFT Certificates",
      description: "Issue verifiable credentials",
    },
    {
      Icon: Wallet,
      title: "Crypto Payments",
      description: "Earn XLM automatically",
    },
    {
      Icon: Users,
      title: "Global Audience",
      description: "Reach learners worldwide",
    },
    {
      Icon: ChartSpline,
      title: "Analytics Dashboard",
      description: "Track student progress",
    },
  ];

  return (
    <div className="bg-slate-100 border border-gray-200 shadow-lg rounded-lg p-6 sm:p-8 w-11/12 max-w-4xl mx-auto">
      <div className="flex flex-col items-center space-y-6">
        <div className="bg-slate-200 rounded-full p-4 mb-4">
          <Check className="w-10 h-10 text-sky-600" />
        </div>

        <div className="text-center space-y-4">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">
            Application Submitted Successfully
          </h2>
          <p className="text-gray-500 max-w-2xl mx-auto text-sm sm:text-base">
            Thank you for applying to become an instructor at ChainVerse Academy
          </p>
          <p className="text-gray-700 max-w-2xl mx-auto text-sm sm:text-base">
            Our team will review your application and get back to you within 5-7
            business days. In the meantime, you can explore our platform and
            prepare for your teaching journey.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-8 w-full">
          {features.map((feature, index) => (
            <FeatureItem
              key={index}
              Icon={feature.Icon}
              title={feature.title}
              description={feature.description}
            />
          ))}
        </div>
        <Link href={"/"}>
          <Button className="text-white mt-5">Return to Home</Button>
        </Link>
      </div>
    </div>
  );
};

export default SuccessModal;