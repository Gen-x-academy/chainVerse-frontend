import NavBar from "@/components/NavBar";

export default function MainLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <NavBar />
      <main className="min-h-screen">
          {children}
        </main>
    </>
  );
}
