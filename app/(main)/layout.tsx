import NavBar from "@/components/NavBar";

export default function MainLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <NavBar />
      <main className="mt-25 min-h-screen">
          {children}
        </main>
    </>
  );
}
