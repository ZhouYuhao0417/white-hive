import { motion } from 'framer-motion'

export function SectionHeader({ eyebrow, title, desc, center = false }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
      className={`max-w-3xl ${center ? 'mx-auto text-center' : ''}`}
    >
      {eyebrow && <div className="mono-label mb-3 sm:mb-4 text-[10px] sm:text-[11px]">{eyebrow}</div>}
      <h2 className="text-2xl sm:text-3xl md:text-4xl font-semibold tracking-tight text-white leading-tight">
        {title}
      </h2>
      {desc && (
        <p className="mt-3 sm:mt-4 text-white/60 leading-relaxed text-sm sm:text-base md:text-lg">
          {desc}
        </p>
      )}
    </motion.div>
  )
}

export function Section({ id, children, className = '' }) {
  return (
    <section id={id} className={`relative py-14 sm:py-24 md:py-32 ${className}`}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-10">{children}</div>
    </section>
  )
}

export function Reveal({ children, delay = 0, y = 24 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.55, ease: 'easeOut', delay }}
    >
      {children}
    </motion.div>
  )
}
