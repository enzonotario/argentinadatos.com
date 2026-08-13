<script setup>
import { ref, onMounted } from 'vue'
import SponsorsAvatars from './sponsors/SponsorsAvatars.vue'
import Ads from './Ads.vue'
import Orbit from './Orbit.vue'

const isVisible = ref(false)

onMounted(() => {
  setTimeout(() => {
    isVisible.value = true
  }, 100)
})

// Fuentes de datos de la API (ordenadas según importancia)
// Logos en datos/static/logos, servidos por api.argentinadatos.com
// transparent: true = solo logo sin fondo, false/undefined = con fondo blanco
const STATIC_LOGO = name =>
  `https://api.argentinadatos.com/static/logos/${name}`

const dataSources = {
  inner: [
    {
      name: 'BCRA',
      logo: STATIC_LOGO('bcra.png'),
      url: 'https://www.bcra.gob.ar/',
      transparent: true,
    },
    {
      name: 'INDEC',
      logo: STATIC_LOGO('indec.png'),
      url: 'https://www.indec.gob.ar/',
      transparent: false,
    },
    {
      name: 'CNV',
      logo: STATIC_LOGO('cnv.png'),
      url: 'https://www.cnv.gov.ar/SitioWeb/FondosComunesInversion/CuotaPartes',
      transparent: true,
    },
    {
      name: 'BNA',
      logo: STATIC_LOGO('bna.png'),
      url: 'https://www.bna.com.ar/',
      transparent: true,
    },
  ],
  outer: [
    {
      name: 'Diputados',
      logo: STATIC_LOGO('diputados.png'),
      url: 'https://www.hcdn.gob.ar/',
      transparent: false,
    },
    {
      name: 'Senado',
      logo: STATIC_LOGO('senado.png'),
      url: 'https://www.senado.gob.ar/',
      transparent: false,
    },
    {
      name: 'UTDT',
      logo: STATIC_LOGO('utdt.png'),
      url: 'https://www.utdt.edu/icg',
      transparent: true,
    },
    {
      name: 'Ministerio de Economía',
      logo: STATIC_LOGO('economia.png'),
      url: 'https://www.argentina.gob.ar/economia',
      transparent: true,
    },
    {
      name: 'JP Morgan',
      logo: STATIC_LOGO('jpmorgan.svg'),
      url: 'https://www.jpmorgan.com/',
      transparent: false,
    },
    {
      name: 'Ámbito',
      logo: STATIC_LOGO('ambito.png'),
      url: 'https://www.ambito.com/',
      transparent: true,
    },
    {
      name: 'La Nación',
      logo: STATIC_LOGO('lanacion.png'),
      url: 'https://www.lanacion.com.ar/',
      transparent: true,
    },
    {
      name: 'Wikipedia',
      logo: STATIC_LOGO('wikipedia.png'),
      url: 'https://es.wikipedia.org/',
      transparent: true,
    },
  ],
}
</script>

<template>
  <div class="home-container">
    <section class="hero-section">
      <div class="hero-glow" />

      <div class="hero-content" :class="{ 'is-visible': isVisible }">
        <h1 class="hero-title">
          <span class="_gradient-text">ArgentinaDatos</span>
        </h1>

        <p class="hero-subtitle">API y Visualizaciones de Datos de Argentina</p>

        <div class="orbit-system" :class="{ 'is-visible': isVisible }">
          <Orbit
            v-for="(source, index) in dataSources.inner"
            :key="`inner-${index}`"
            :radius="120"
            :duration="35"
            :delay="index * -(35 / dataSources.inner.length)"
            direction="normal"
            :path="index === 0"
          >
            <a
              :href="source.url"
              target="_blank"
              rel="noreferrer"
              class="orbit-logo"
              :class="{ 'orbit-logo-transparent': source.transparent }"
              :title="source.name"
            >
              <img
                :src="source.logo"
                :alt="source.name"
                class="orbit-logo-img"
              />
            </a>
          </Orbit>

          <Orbit
            v-for="(source, index) in dataSources.outer"
            :key="`outer-${index}`"
            :radius="190"
            :duration="50"
            :delay="index * -(50 / dataSources.outer.length)"
            direction="reverse"
            :path="index === 0"
          >
            <a
              :href="source.url"
              target="_blank"
              rel="noreferrer"
              class="orbit-logo orbit-logo-sm"
              :class="{ 'orbit-logo-transparent': source.transparent }"
              :title="source.name"
            >
              <img
                :src="source.logo"
                :alt="source.name"
                class="orbit-logo-img"
              />
            </a>
          </Orbit>

          <div class="center-logo">
            <img
              src="/assets/logo.png"
              alt="ArgentinaDatos"
              class="argentina-logo"
            />
            <div class="center-glow" />
          </div>
        </div>
      </div>
    </section>

    <section class="bento-section">
      <div class="bento-grid">
        <div
          class="bento-card bento-card-lg api-card"
          :class="{ 'is-visible': isVisible }"
        >
          <div class="card-icon">
            <span class="i-mdi-code-json" />
          </div>
          <div class="card-content">
            <h2 class="!border-t-0 !pt-0">API Pública</h2>
            <p>
              API desarrollada en
              <a
                href="https://es.js.org/?ref=argentinadatos.com"
                target="_blank"
                rel="noreferrer"
                >EsJS</a
              >
              para acceder a datos de Argentina de forma gratuita y sin límites.
            </p>
          </div>
          <div class="card-actions">
            <a class="btn btn-primary" href="/docs/">
              <span class="i-mdi-book-open-variant" />
              Documentación
            </a>
            <a
              class="btn btn-ghost"
              href="https://github.com/enzonotario/esjs-argentina-datos-api"
              target="_blank"
              rel="noreferrer"
            >
              <span class="i-mdi-github" />
              GitHub
            </a>
          </div>
          <div class="card-decoration" />
        </div>

        <div
          class="bento-card bento-card-md viz-card"
          :class="{ 'is-visible': isVisible }"
        >
          <div class="card-icon">
            <span class="i-mdi-chart-areaspline" />
          </div>
          <div class="card-content">
            <h2 class="!border-t-0 !pt-0">Visualizaciones</h2>
            <p>Gráficos interactivos con datos económicos actualizados</p>
          </div>
          <div class="card-actions">
            <a
              class="btn btn-primary"
              href="https://app.argentinadatos.com/"
              target="_blank"
              rel="noreferrer"
            >
              <span class="i-mdi-open-in-new" />
              Explorar
            </a>
            <a
              class="btn btn-ghost"
              href="https://github.com/enzonotario/argentina-datos-app"
              target="_blank"
              rel="noreferrer"
            >
              <span class="i-mdi-github" />
            </a>
          </div>
          <div class="card-decoration" />
        </div>

        <div
          class="bento-card bento-card-md senadores-card"
          :class="{ 'is-visible': isVisible }"
        >
          <div class="card-icon">
            <span class="i-mdi-account-group" />
          </div>
          <div class="card-content">
            <h2 class="!border-t-0 !pt-0">Senadores</h2>
            <p>Votaciones del Senado de la Nación</p>
          </div>
          <div class="card-actions">
            <a
              class="btn btn-primary"
              href="https://senadores.argentinadatos.com/"
              target="_blank"
              rel="noreferrer"
            >
              <span class="i-mdi-open-in-new" />
              Ver
            </a>
            <a
              class="btn btn-ghost"
              href="https://github.com/ferminrp/senadores"
              target="_blank"
              rel="noreferrer"
            >
              <span class="i-mdi-github" />
            </a>
          </div>
        </div>

        <div
          class="bento-card bento-card-md diputados-card"
          :class="{ 'is-visible': isVisible }"
        >
          <div class="card-icon">
            <span class="i-mdi-account-multiple" />
          </div>
          <div class="card-content">
            <h2 class="!border-t-0 !pt-0">Diputados</h2>
            <p>Votaciones de la Cámara de Diputados</p>
          </div>
          <div class="card-actions">
            <a
              class="btn btn-primary"
              href="https://diputados.argentinadatos.com/"
              target="_blank"
              rel="noreferrer"
            >
              <span class="i-mdi-open-in-new" />
              Ver
            </a>
            <a
              class="btn btn-ghost"
              href="https://github.com/enzonotario/diputados"
              target="_blank"
              rel="noreferrer"
            >
              <span class="i-mdi-github" />
            </a>
          </div>
        </div>
      </div>
    </section>

    <section class="footer-section">
      <div class="sponsors-wrapper">
        <h2 class="section-title !border-t-0">
          <span class="i-mdi-heart text-rose-500" />
          Sponsors
        </h2>
        <SponsorsAvatars :size="52" />
      </div>

      <div class="banner-wrapper">
        <Ads />
      </div>
    </section>

    <div class="pt-12">
      <hr />
    </div>

    <section class="mt-24 -mb-24 flex justify-center">
      <a
        href="https://malvinas.argentinadatos.com/"
        target="_blank"
        rel="noreferrer"
        class="block"
      >
        <img
          src="https://malvinas.argentinadatos.com/strip.png"
          width="800"
          height="130"
          alt="Islas Malvinas Argentinas — Franja"
        />
      </a>
    </section>
  </div>
</template>

<style scoped>
@reference "tailwindcss";

.home-container {
  --accent-primary: #18181b;
  --accent-secondary: #3f3f46;
  --accent-tertiary: #52525b;

  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
  @apply sm:px-6;
}

.dark .home-container {
  --accent-primary: #fafafa;
  --accent-secondary: #e4e4e7;
  --accent-tertiary: #a1a1aa;
}

/* Hero Section */
.hero-section {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 1rem 0;
  overflow: hidden;
}

.hero-glow {
  position: absolute;
  top: 30%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 700px;
  height: 700px;
  background: radial-gradient(
    circle,
    rgba(99, 102, 241, 0.1) 0%,
    rgba(139, 92, 246, 0.06) 30%,
    transparent 70%
  );
  pointer-events: none;
  z-index: 0;
}

.dark .hero-glow {
  background: radial-gradient(
    circle,
    rgba(99, 102, 241, 0.15) 0%,
    rgba(139, 92, 246, 0.1) 30%,
    transparent 70%
  );
}

/* Orbit System */
.orbit-system {
  position: relative;
  width: 450px;
  height: 450px;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transform: scale(0.9);
  transition: all 1s cubic-bezier(0.16, 1, 0.3, 1);
}

.orbit-system.is-visible {
  opacity: 1;
  transform: scale(1);
}

@media (max-width: 768px) {
  .orbit-system {
    width: 320px;
    height: 320px;
    transform: scale(0.75);
  }

  .orbit-system.is-visible {
    transform: scale(0.75);
  }
}

@media (max-width: 480px) {
  .orbit-system {
    width: 280px;
    height: 280px;
    transform: scale(0.6);
  }

  .orbit-system.is-visible {
    transform: scale(0.6);
  }
}

/* Center Logo */
.center-logo {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}

.argentina-logo {
  width: 80px;
  height: 80px;
  object-fit: contain;
  position: relative;
  z-index: 2;
  filter: drop-shadow(0 8px 24px rgba(99, 102, 241, 0.35));
  pointer-events: auto;
}

.dark .argentina-logo {
  filter: drop-shadow(0 8px 24px rgba(139, 92, 246, 0.4));
}

.center-glow {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 120px;
  height: 120px;
  background: radial-gradient(
    circle,
    rgba(99, 102, 241, 0.4) 0%,
    rgba(139, 92, 246, 0.2) 40%,
    transparent 70%
  );
  animation: center-pulse 3s ease-in-out infinite;
  z-index: 1;
  pointer-events: none;
}

.dark .center-glow {
  background: radial-gradient(
    circle,
    rgba(139, 92, 246, 0.5) 0%,
    rgba(99, 102, 241, 0.25) 40%,
    transparent 70%
  );
}

@keyframes center-pulse {
  0%,
  100% {
    transform: translate(-50%, -50%) scale(1);
    opacity: 0.8;
  }
  50% {
    transform: translate(-50%, -50%) scale(1.2);
    opacity: 1;
  }
}

/* Orbit Logos */
.orbit-logo {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 52px;
  height: 52px;
  padding: 4px;
  background: rgba(255, 255, 255, 0.98);
  border: 1px solid rgba(229, 231, 235, 0.8);
  border-radius: 12px;
  text-decoration: none !important;
  transition: all 0.3s ease;
  box-shadow:
    0 4px 12px -2px rgba(0, 0, 0, 0.1),
    0 0 0 1px rgba(255, 255, 255, 0.5);
}

.dark .orbit-logo {
  background: rgba(255, 255, 255, 0.95);
  border-color: rgba(229, 231, 235, 0.6);
  box-shadow:
    0 4px 12px -2px rgba(0, 0, 0, 0.3),
    0 0 0 1px rgba(255, 255, 255, 0.1);
}

.orbit-logo:hover {
  transform: scale(1.2) !important;
  border-color: rgba(99, 102, 241, 0.5);
  box-shadow:
    0 8px 24px -4px rgba(0, 0, 0, 0.2),
    0 0 0 2px rgba(99, 102, 241, 0.3);
  z-index: 100;
}

.orbit-logo-img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  border-radius: 4px;
}

.orbit-logo-sm {
  width: 44px;
  height: 44px;
  padding: 6px;
  border-radius: 10px;
}

/* Transparent mode - solo logo sin fondo */
.orbit-logo-transparent {
  background: transparent;
  border: none;
  box-shadow: none;
  padding: 0;
}

.dark .orbit-logo-transparent {
  background: transparent;
  border: none;
  box-shadow: none;
}

.orbit-logo-transparent:hover {
  background: transparent;
  border: none;
  box-shadow: none;
  transform: scale(1.25) !important;
}

.orbit-logo-transparent .orbit-logo-img {
  filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.15));
}

.dark .orbit-logo-transparent .orbit-logo-img {
  filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.4));
}

/* Hero Content */
.hero-content {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  opacity: 0;
  transform: translateY(20px);
  transition: all 0.8s cubic-bezier(0.16, 1, 0.3, 1);
  transition-delay: 0.3s;
}

.hero-content.is-visible {
  opacity: 1;
  transform: translateY(0);
}

.hero-title {
  font-size: 3rem;
  font-weight: 800;
  letter-spacing: -0.04em;
  line-height: 1;
  margin: 0;
}

@media (max-width: 640px) {
  .hero-title {
    font-size: 2.25rem;
  }
}

.gradient-text {
  background: linear-gradient(
    135deg,
    var(--accent-primary) 0%,
    var(--accent-secondary) 50%,
    var(--accent-tertiary) 100%
  );
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}

.hero-subtitle {
  font-size: 1.125rem;
  color: #6b7280;
  text-align: center;
  margin: 0;
  max-width: 400px;
}

.dark .hero-subtitle {
  color: #9ca3af;
}

.hero-description {
  font-size: 0.9375rem;
  color: #6b7280;
  text-align: center;
  margin: 0;
  max-width: 500px;
  line-height: 1.6;
}

.dark .hero-description {
  color: #9ca3af;
}

.hero-description strong {
  color: #374151;
  font-weight: 600;
}

.dark .hero-description strong {
  color: #e5e7eb;
}

.hero-badges {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.75rem;
  margin-top: 0.5rem;
}

.badge {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  font-size: 0.875rem;
  font-weight: 500;
  color: #4b5563;
  background: rgba(243, 244, 246, 0.8);
  border: 1px solid rgba(229, 231, 235, 0.8);
  border-radius: 9999px;
  backdrop-filter: blur(8px);
}

.dark .badge {
  color: #d4d4d8;
  background: rgba(39, 39, 42, 0.8);
  border-color: rgba(63, 63, 70, 0.8);
}

/* Bento Grid */
.bento-section {
  padding: 2rem 0;
}

.bento-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  grid-template-rows: auto auto;
  gap: 1.25rem;
}

@media (max-width: 900px) {
  .bento-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 600px) {
  .bento-grid {
    grid-template-columns: 1fr;
  }
}

.bento-card {
  position: relative;
  display: flex;
  flex-direction: column;
  padding: 1.75rem;
  background: rgba(250, 250, 250, 0.6);
  border: 1px solid rgba(228, 228, 231, 0.8);
  border-radius: 1.25rem;
  overflow: hidden;
  transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
  opacity: 0;
  transform: translateY(30px);
}

.bento-card.is-visible {
  opacity: 1;
  transform: translateY(0);
}

.bento-card:nth-child(1) {
  transition-delay: 0.1s;
}
.bento-card:nth-child(2) {
  transition-delay: 0.2s;
}
.bento-card:nth-child(3) {
  transition-delay: 0.3s;
}
.bento-card:nth-child(4) {
  transition-delay: 0.4s;
}

.dark .bento-card {
  background: rgba(39, 39, 42, 0.6);
  border-color: rgba(82, 82, 91, 0.5);
}

.bento-card:hover {
  transform: translateY(-4px);
  box-shadow:
    0 20px 40px -12px rgba(0, 0, 0, 0.12),
    0 0 0 1px rgba(0, 0, 0, 0.06);
  border-color: rgba(0, 0, 0, 0.15);
}

.dark .bento-card:hover {
  box-shadow:
    0 20px 40px -12px rgba(0, 0, 0, 0.5),
    0 0 0 1px rgba(113, 113, 122, 0.2);
  border-color: rgba(113, 113, 122, 0.4);
}

/* Card Sizes */
.bento-card-lg {
  grid-column: span 2;
}

.bento-card-md {
  grid-column: span 2;
}

.bento-card-sm {
  grid-column: span 1;
}

@media (max-width: 600px) {
  .bento-card-lg,
  .bento-card-md,
  .bento-card-sm {
    grid-column: span 1;
  }
}

/* Card Elements */
.card-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  margin-bottom: 1rem;
  border-radius: 12px;
  font-size: 1.5rem;
}

.api-card .card-icon {
  background: linear-gradient(135deg, rgba(0, 0, 0, 0.08), rgba(0, 0, 0, 0.03));
  color: #18181b;
}

.dark .api-card .card-icon {
  background: linear-gradient(
    135deg,
    rgba(255, 255, 255, 0.12),
    rgba(255, 255, 255, 0.05)
  );
  color: #fafafa;
}

.viz-card .card-icon {
  background: linear-gradient(135deg, rgba(0, 0, 0, 0.08), rgba(0, 0, 0, 0.03));
  color: #18181b;
}

.dark .viz-card .card-icon {
  background: linear-gradient(
    135deg,
    rgba(255, 255, 255, 0.12),
    rgba(255, 255, 255, 0.05)
  );
  color: #fafafa;
}

.senadores-card .card-icon {
  background: linear-gradient(135deg, rgba(0, 0, 0, 0.08), rgba(0, 0, 0, 0.03));
  color: #18181b;
}

.dark .senadores-card .card-icon {
  background: linear-gradient(
    135deg,
    rgba(255, 255, 255, 0.12),
    rgba(255, 255, 255, 0.05)
  );
  color: #fafafa;
}

.diputados-card .card-icon {
  background: linear-gradient(135deg, rgba(0, 0, 0, 0.08), rgba(0, 0, 0, 0.03));
  color: #18181b;
}

.dark .diputados-card .card-icon {
  background: linear-gradient(
    135deg,
    rgba(255, 255, 255, 0.12),
    rgba(255, 255, 255, 0.05)
  );
  color: #fafafa;
}

.card-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.card-content h2 {
  font-size: 1.375rem;
  font-weight: 700;
  letter-spacing: -0.02em;
  margin: 0;
  color: #111827;
}

.dark .card-content h2 {
  color: #f9fafb;
}

.card-content p {
  font-size: 0.9375rem;
  color: #6b7280;
  margin: 0;
  line-height: 1.5;
}

.dark .card-content p {
  color: #9ca3af;
}

.card-content a {
  color: #18181b;
  text-decoration: none;
  font-weight: 600;
}

.dark .card-content a {
  color: #fafafa;
}

.card-content a:hover {
  text-decoration: underline;
}

.code-preview {
  margin-top: 0.75rem;
  padding: 0.75rem 1rem;
  background: rgba(0, 0, 0, 0.05);
  border-radius: 8px;
  overflow-x: auto;
}

.dark .code-preview {
  background: rgba(255, 255, 255, 0.08);
}

.code-preview code {
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  font-size: 0.8125rem;
  color: #18181b;
}

.dark .code-preview code {
  color: #fafafa;
}

.card-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-top: 1.25rem;
}

.card-decoration {
  position: absolute;
  top: 0;
  right: 0;
  width: 150px;
  height: 150px;
  background: radial-gradient(
    circle at top right,
    rgba(0, 0, 0, 0.03),
    transparent 70%
  );
  pointer-events: none;
}

.dark .card-decoration {
  background: radial-gradient(
    circle at top right,
    rgba(255, 255, 255, 0.04),
    transparent 70%
  );
}

/* Buttons */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.625rem 1.25rem;
  font-size: 0.875rem;
  font-weight: 600;
  border-radius: 9999px;
  text-decoration: none !important;
  transition: all 0.2s ease;
  cursor: pointer;
}

.btn-primary {
  background: #18181b;
  color: white !important;
  box-shadow: 0 4px 14px -4px rgba(0, 0, 0, 0.25);
}

.dark .btn-primary {
  background: #fafafa;
  color: #18181b !important;
  box-shadow: 0 4px 14px -4px rgba(255, 255, 255, 0.15);
}

.btn-primary:hover {
  box-shadow: 0 6px 20px -4px rgba(0, 0, 0, 0.35);
  transform: translateY(-1px);
}

.dark .btn-primary:hover {
  box-shadow: 0 6px 20px -4px rgba(255, 255, 255, 0.25);
}

.btn-ghost {
  background: rgba(107, 114, 128, 0.1);
  color: #4b5563 !important;
}

.dark .btn-ghost {
  background: rgba(156, 163, 175, 0.1);
  color: #d1d5db !important;
}

.btn-ghost:hover {
  background: rgba(107, 114, 128, 0.2);
}

.dark .btn-ghost:hover {
  background: rgba(156, 163, 175, 0.2);
}

/* Footer Section */
.footer-section {
  display: flex;
  flex-direction: column;
  gap: 3rem;
}

.dark .footer-section {
  border-top-color: rgba(55, 65, 81, 0.6);
}

.section-title {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  font-size: 1.5rem;
  font-weight: 700;
  letter-spacing: -0.02em;
  margin: 0 0 1.5rem;
  color: #111827;
}

.dark .section-title {
  color: #f9fafb;
}

.sponsors-wrapper {
  text-align: center;
}

.sponsors-wrapper :deep(.flex) {
  justify-content: center;
}

.banner-wrapper {
  max-width: 1200px;
  margin: 0 auto;
}
</style>
