import { fetchRates } from "@/lib/rates";
import { Nav } from "@/components/Nav";
import { Hero } from "@/components/Hero";
import { Ticker } from "@/components/Ticker";
import { Stats } from "@/components/Stats";
import { HowItWorks } from "@/components/HowItWorks";
import { Methods } from "@/components/Methods";
import { FAQ } from "@/components/FAQ";
import { CTA } from "@/components/CTA";
import { Footer } from "@/components/Footer";

export default async function Home() {
  const rates = await fetchRates();

  return (
    <>
      <Nav />
      <main>
        <Hero alipayRate={rates.alipay} />
        <Ticker />
        <Stats />
        <HowItWorks />
        <Methods />
        <FAQ />
        <CTA />
      </main>
      <Footer />
    </>
  );
}
