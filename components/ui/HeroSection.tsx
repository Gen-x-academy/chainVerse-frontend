import React from "react";
import Link from "next/link";

import { Button } from "./button";
import { ArrowRight } from "lucide-react";
import { BlockchainAnimation } from "../animations/blockchain-animation";

const HeroSection: React.FC = () => {
  return (
    <div className="w-full mx-auto py-12 md:py-24 lg:py-32 xl:py-48 overflow-hidden container px-4 md:px-6 grid gap-6 lg:grid-cols-2 lg:gap-12 xl:grid-cols-2">
      <div className="flex flex-col justify-center space-y-4">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl lg:text-6xl/none bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent">
            Learn Blockchain. Earn Crypto.
          </h1>
          <p className="max-w-[600px] text-muted-foreground md:text-xl font-medium">
            ChainVerse Academy is a decentralized learning platform built on
            Stellar blockchain, offering courses on Web3, cryptocurrency, and
            blockchain technology.
          </p>
        </div>
        <div className="flex flex-col gap-2 min-[400px]:flex-row">
          <Button
            size="lg"
            className="bg-gradient-to-r from-primary to-secondary hover:from-primary/90 hover:to-secondary/90 text-white"
            asChild
          >
            <Link href="/">
              Explore Courses
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="border-primary text-primary hover:bg-primary/10"
            asChild
          >
            <Link href="/instructor_register">Become an Instructor</Link>
          </Button>
        </div>
      </div>
      <div className="flex items-center justify-center">
        <BlockchainAnimation />
      </div>
    </div>
  );
};

export default HeroSection;
