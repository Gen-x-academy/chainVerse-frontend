import Image from 'next/image'
import './Features.css'

const features = [
  {
    title: 'Real-time Tracking',
    description:
      'Monitor activity the moment it happens with live, in-motion updates.',
    icon: '/images/icons/real-time-tracking.svg',
  },
  {
    title: 'Immutable Records',
    description:
      'Every action is captured in a tamper-proof ledger you can trust.',
    icon: '/images/icons/immutable-records.svg',
  },
  {
    title: 'Automated Settlements',
    description:
      'Trigger payouts and reconciliations instantly without manual steps.',
    icon: '/images/icons/automated-settlements.svg',
  },
  {
    title: 'Responsive Dashboard',
    description:
      'Stay in control on any device with a clean, adaptive interface.',
    icon: '/images/icons/responsive-dashboard.svg',
  },
]

export function Features() {
  return (
    <section className="features-section">
      <div className="features-header">
        <p className="features-eyebrow">Navin Value</p>
        <h2 className="features-title">Key value propositions</h2>
        <p className="features-subtitle">
          Built for visibility, trust, and speed across every transaction.
        </p>
      </div>

      <div className="features-grid">
        {features.map((feature) => (
          <article className="feature-card" key={feature.title}>
            <div className="feature-icon">
              <Image src={feature.icon} alt="" aria-hidden={true} width={48} height={48} />
            </div>
            <h3 className="feature-title">{feature.title}</h3>
            <p className="feature-description">{feature.description}</p>
          </article>
        ))}
      </div>
    </section>
  )
}
