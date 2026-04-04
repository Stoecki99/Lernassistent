import LandingNavbar from "@/components/features/LandingNavbar"
import LandingHero from "@/components/features/LandingHero"
import LandingFeatures from "@/components/features/LandingFeatures"
import LandingSocialProof from "@/components/features/LandingSocialProof"
import LandingFooter from "@/components/features/LandingFooter"

export default function Home() {
  return (
    <>
      <LandingNavbar />
      <main>
        <LandingHero />
        <LandingFeatures />
        <LandingSocialProof />
      </main>
      <LandingFooter />
    </>
  )
}
