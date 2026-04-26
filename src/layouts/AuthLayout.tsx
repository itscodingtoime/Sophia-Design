import { ReactNode } from 'react';
import { C } from '../theme';
import innersystemsLogo from '../assets/innersystems-logo-white.png';

interface AuthLayoutProps {
  children: ReactNode;
  title: ReactNode;
  subtitle?: string;
}

const AuthLayout = ({ children, title, subtitle }: AuthLayoutProps) => {
  return (
    <div style={{
      width: "100%", height: "100vh", position: "relative", overflow: "hidden",
      fontFamily: "'Tomorrow', sans-serif",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Josefin+Sans:wght@300;400;500;600;700&family=Tomorrow:wght@300;400;500;600&display=swap');
        @keyframes authFadeIn { from { opacity: 0; transform: translateY(24px) scale(0.97); } to { opacity: 1; transform: translateY(0) scale(1); } }
        @keyframes authBgZoom { from { transform: scale(1.05); } to { transform: scale(1); } }
        @keyframes orbFloat { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
        @keyframes orbSwirl { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        @keyframes orbSwirlRev { 0% { transform: rotate(0deg); } 100% { transform: rotate(-360deg); } }
        @keyframes orbPulse { 0%,100% { opacity: 0.4; transform: scale(1); } 50% { opacity: 0.7; transform: scale(1.08); } }
        @keyframes ripple1 { 0% { transform: scale(1); opacity: 0.5; } 100% { transform: scale(2.0); opacity: 0; } }
        @keyframes ripple2 { 0% { transform: scale(1); opacity: 0.4; } 100% { transform: scale(2.3); opacity: 0; } }
        @keyframes ripple3 { 0% { transform: scale(1); opacity: 0.3; } 100% { transform: scale(2.5); opacity: 0; } }
        .sophia-auth-card .cl-rootBox,
        .sophia-auth-card .cl-card,
        .sophia-auth-card .cl-signIn-root,
        .sophia-auth-card .cl-signUp-root,
        .sophia-auth-card .cl-cardBox,
        .sophia-auth-card .cl-signIn-start,
        .sophia-auth-card .cl-signUp-start {
          background: transparent !important;
          box-shadow: none !important;
          border: none !important;
          padding: 0 !important;
          margin: 0 !important;
        }
        .sophia-auth-card .cl-card {
          padding: 0 !important;
        }
        .sophia-auth-card .cl-footer {
          padding: 4px 0 0 !important;
        }
        .sophia-auth-card .cl-rootBox {
          width: 100% !important;
        }
        .sophia-auth-card .cl-card {
          width: 100% !important;
          max-width: 100% !important;
        }
        /* Hide "Last used" badge — nuclear approach */
        .sophia-auth-card .cl-socialButtonsProviderIcon__lastUsed,
        .sophia-auth-card [data-localization-key*="lastUsed"],
        .sophia-auth-card [data-localization-key*="LastUsed"],
        .sophia-auth-card .cl-badge,
        .sophia-auth-card .cl-tag,
        .sophia-auth-card .cl-tagPrimaryContainer,
        .sophia-auth-card .cl-socialButtonsBlockButtonText__lastUsed,
        .sophia-auth-card .cl-socialButtonsBlockButton__lastUsed .cl-socialButtonsBlockButtonText ~ *,
        .sophia-auth-card .cl-socialButtonsBlockButtonText + span,
        .sophia-auth-card .cl-socialButtonsBlockButton span[style],
        .sophia-auth-card span:has(+ .cl-socialButtonsBlockButtonArrow) {
          display: none !important;
          visibility: hidden !important;
          width: 0 !important;
          height: 0 !important;
          overflow: hidden !important;
          position: absolute !important;
          opacity: 0 !important;
        }
        .sophia-auth-card .cl-socialButtonsBlockButton {
          overflow: hidden !important;
          position: relative !important;
        }
        /* Also catch any badge-like span after the provider text */
        .sophia-auth-card .cl-socialButtonsBlockButtonText + * {
          display: none !important;
        }
        /* Hide Clerk branding / "Secured by" / "Development mode" */
        .sophia-auth-card .cl-footerPages,
        .sophia-auth-card .cl-internal-b3fm6y,
        .sophia-auth-card .cl-footer > div:last-child,
        .sophia-auth-card [class*="powered"],
        .sophia-auth-card .cl-footerPagesLink {
          display: none !important;
        }
        /* Style the "Don't have account? Sign up" link area */
        .sophia-auth-card .cl-footerAction {
          background: transparent !important;
          border: none !important;
          box-shadow: none !important;
          padding: 8px 0 0 !important;
        }
        .sophia-auth-card .cl-footerAction__signIn,
        .sophia-auth-card .cl-footerAction__signUp {
          background: transparent !important;
        }
        /* Continue button styling */
        .sophia-auth-card .cl-formButtonPrimary {
          margin-top: 4px !important;
        }
        /* Make sure cardBox footer area is transparent */
        .sophia-auth-card .cl-cardBox > :last-child,
        .sophia-auth-card .cl-cardBox .cl-footer {
          background: transparent !important;
          box-shadow: none !important;
          border: none !important;
        }
        .sophia-auth-card .cl-headerTitle,
        .sophia-auth-card .cl-headerSubtitle {
          display: none !important;
        }
        .sophia-auth-card .cl-socialButtonsBlockButton {
          background: rgba(255,255,255,0.92) !important;
          border: 1px solid rgba(255,255,255,0.3) !important;
          border-radius: 12px !important;
          font-family: 'Tomorrow', sans-serif !important;
          font-weight: 500 !important;
          font-size: 14px !important;
          color: #3c4043 !important;
          padding: 12px 20px !important;
          transition: all 0.2s ease !important;
          box-shadow: 0 2px 8px rgba(0,0,0,0.15) !important;
        }
        .sophia-auth-card .cl-socialButtonsBlockButton:hover {
          background: rgba(255,255,255,0.97) !important;
          transform: translateY(-1px) !important;
          box-shadow: 0 4px 16px rgba(0,0,0,0.2) !important;
        }
        .sophia-auth-card .cl-formButtonPrimary {
          background: rgba(255,255,255,0.92) !important;
          color: #3c4043 !important;
          border-radius: 12px !important;
          font-family: 'Tomorrow', sans-serif !important;
          font-weight: 500 !important;
          border: 1px solid rgba(255,255,255,0.3) !important;
          box-shadow: 0 2px 8px rgba(0,0,0,0.15) !important;
        }
        .sophia-auth-card .cl-formButtonPrimary:hover {
          background: rgba(255,255,255,0.97) !important;
        }
        .sophia-auth-card .cl-formFieldInput {
          background: rgba(255,255,255,0.12) !important;
          border: 1px solid rgba(255,255,255,0.2) !important;
          border-radius: 10px !important;
          color: #fff !important;
          font-family: 'Tomorrow', sans-serif !important;
        }
        .sophia-auth-card .cl-formFieldInput::placeholder {
          color: rgba(255,255,255,0.4) !important;
        }
        .sophia-auth-card .cl-formFieldLabel,
        .sophia-auth-card .cl-footerActionText,
        .sophia-auth-card .cl-footerActionLink,
        .sophia-auth-card .cl-dividerText {
          color: rgba(255,255,255,0.6) !important;
          font-family: 'Tomorrow', sans-serif !important;
        }
        .sophia-auth-card .cl-footerActionLink {
          color: rgba(255,255,255,0.85) !important;
          text-decoration: underline !important;
        }
        .sophia-auth-card .cl-dividerLine {
          background: rgba(255,255,255,0.15) !important;
        }
        .sophia-auth-card .cl-internal-b3fm6y {
          color: rgba(255,255,255,0.5) !important;
        }
      `}</style>

      {/* Mountain background */}
      <div style={{
        position: "absolute", inset: 0, zIndex: 0,
        animation: "authBgZoom 1.8s ease-out forwards",
      }}>
        <img
          src="/sophia-mountain-bg.jpg"
          alt=""
          style={{
            width: "100%", height: "100%", objectFit: "cover", objectPosition: "center 30%",
            display: "block",
          }}
        />
      </div>

      {/* Gradient overlays */}
      <div style={{
        position: "absolute", inset: 0, zIndex: 1,
        background: "linear-gradient(to top, rgba(15,12,10,0.7) 0%, rgba(15,12,10,0.3) 35%, rgba(15,12,10,0.05) 60%, transparent 100%)",
      }} />
      <div style={{
        position: "absolute", inset: 0, zIndex: 1,
        background: "radial-gradient(ellipse 80% 60% at 50% 50%, rgba(15,12,10,0.35) 0%, transparent 70%)",
      }} />

      {/* Content */}
      <div style={{
        position: "absolute", inset: 0, zIndex: 2,
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "20px 0",
        overflowY: "auto",
      }}>
        <div style={{
          width: 480, maxWidth: "92vw",
          maxHeight: "calc(100vh - 40px)",
          background: "rgba(255,255,255,0.12)",
          backdropFilter: "blur(28px) saturate(1.4)",
          WebkitBackdropFilter: "blur(28px) saturate(1.4)",
          borderRadius: 24,
          border: "1px solid rgba(255,255,255,0.2)",
          boxShadow: "0 32px 80px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.05) inset, 0 1px 0 rgba(255,255,255,0.15) inset",
          padding: "28px 32px 24px",
          overflow: "hidden",
          animation: "authFadeIn 0.9s ease-out 0.3s both",
        }}>
          {/* Logo + Orb + Branding */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 12 }}>
            <img src={innersystemsLogo} alt="InnerSystems" style={{ width: 120, objectFit: 'contain', marginBottom: 24 }} />
            <div style={{ position: "relative", width: 64, height: 64, marginBottom: 12, animation: "orbFloat 5s ease-in-out infinite" }}>
              {/* Ripple rings */}
              {[0, 1, 2].map(i => (
                <div key={`ripple-${i}`} style={{
                  position: "absolute", inset: -2, borderRadius: "50%",
                  border: "1.5px solid rgba(255,255,255,0.25)",
                  animation: `ripple${i + 1} ${3 + i * 0.6}s ease-out infinite ${i * 1.1}s`,
                  pointerEvents: "none",
                }} />
              ))}
              {/* Glow */}
              <div style={{
                position: "absolute", inset: -20, borderRadius: "50%",
                background: "radial-gradient(circle, rgba(255,255,255,0.16) 0%, hsla(280,50%,80%,0.14) 20%, hsla(200,50%,75%,0.1) 35%, transparent 65%)",
                filter: "blur(20px)", animation: "orbPulse 5s ease-in-out infinite",
              }} />
              {/* Orb body */}
              <div style={{
                position: "absolute", inset: 0, borderRadius: "50%", overflow: "hidden",
                background: "radial-gradient(circle at 40% 35%, rgba(255,255,255,0.92) 0%, rgba(248,250,255,0.75) 20%, rgba(240,245,255,0.55) 45%, rgba(225,235,250,0.4) 70%, rgba(210,220,245,0.32) 100%)",
                boxShadow: "inset 0 0 5px rgba(255,255,255,0.7), 0 4px 20px rgba(0,0,0,0.12)",
              }}>
                <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "radial-gradient(ellipse 75% 65% at 28% 25%, hsla(260,85%,68%,0.6) 0%, hsla(230,85%,72%,0.35) 30%, transparent 60%)", animation: "orbSwirl 8s linear infinite" }} />
                <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "radial-gradient(ellipse 55% 70% at 18% 55%, hsla(185,90%,55%,0.65) 0%, hsla(170,85%,60%,0.3) 35%, transparent 65%)", animation: "orbSwirlRev 10s linear infinite" }} />
                <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "radial-gradient(ellipse 50% 50% at 30% 75%, hsla(140,80%,52%,0.5) 0%, hsla(120,70%,58%,0.22) 40%, transparent 65%)", animation: "orbSwirl 12s linear infinite" }} />
                <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "radial-gradient(ellipse 60% 45% at 50% 80%, hsla(48,85%,60%,0.5) 0%, hsla(40,80%,65%,0.22) 40%, transparent 65%)", animation: "orbSwirlRev 9s linear infinite" }} />
                <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "radial-gradient(ellipse 50% 65% at 78% 60%, hsla(20,85%,58%,0.55) 0%, hsla(10,80%,62%,0.28) 35%, transparent 60%)", animation: "orbSwirl 11s linear infinite" }} />
                <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "radial-gradient(ellipse 65% 55% at 72% 28%, hsla(330,85%,62%,0.5) 0%, hsla(310,75%,66%,0.25) 35%, transparent 60%)", animation: "orbSwirlRev 7s linear infinite" }} />
                {/* Rainbow rim */}
                <div style={{
                  position: "absolute", inset: 0, borderRadius: "50%",
                  background: "conic-gradient(from -30deg, hsla(0,90%,60%,0.65) 0%, hsla(30,90%,62%,0.6) 8%, hsla(55,90%,60%,0.55) 14%, hsla(100,85%,55%,0.5) 22%, hsla(160,90%,55%,0.55) 30%, hsla(195,90%,58%,0.6) 38%, hsla(220,90%,60%,0.65) 46%, hsla(260,90%,62%,0.6) 54%, hsla(290,85%,65%,0.55) 62%, hsla(325,90%,62%,0.55) 70%, hsla(350,90%,60%,0.6) 80%, hsla(10,90%,58%,0.6) 90%, hsla(0,90%,60%,0.65) 100%)",
                  WebkitMaskImage: "radial-gradient(circle, transparent 48%, black 68%, black 100%)",
                  maskImage: "radial-gradient(circle, transparent 48%, black 68%, black 100%)",
                  animation: "orbSwirl 18s linear infinite",
                }} />
                {/* Glass core */}
                <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "radial-gradient(circle at 45% 45%, rgba(255,255,255,0.6) 0%, rgba(255,255,255,0.2) 30%, transparent 60%)" }} />
                <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "radial-gradient(ellipse 55% 45% at 32% 28%, rgba(255,255,255,0.85) 0%, rgba(255,255,255,0.55) 18%, rgba(255,255,255,0.15) 50%, transparent 70%)" }} />
              </div>
              {/* Blue rim */}
              <div style={{
                position: "absolute", inset: -3, borderRadius: "50%",
                border: "1.5px solid hsla(215,70%,60%,0.55)",
                boxShadow: "0 0 10px hsla(215,65%,55%,0.25), 0 0 20px hsla(215,60%,60%,0.12)",
              }} />
            </div>

            <h1 style={{
              fontSize: 20, fontWeight: 600, letterSpacing: 4,
              fontFamily: "'Josefin Sans', sans-serif",
              color: "#FFFFFF",
              textShadow: "0 2px 12px rgba(0,0,0,0.4)",
              marginBottom: 4,
              textAlign: "center", width: "100%",
            }}>SOPHIA</h1>

            {title && (
              <p style={{
                fontSize: 13, fontWeight: 400, letterSpacing: 0.3,
                fontFamily: "'Tomorrow', sans-serif",
                color: "rgba(255,255,255,0.65)",
                textAlign: "center", lineHeight: 1.5,
                maxWidth: 300,
              }}>{typeof title === 'string' ? title : 'Culture Intelligence for Modern Teams'}</p>
            )}

            {subtitle && (
              <p style={{
                fontSize: 11, color: "rgba(255,255,255,0.4)",
                fontFamily: "'Tomorrow', sans-serif",
                textAlign: "center", marginTop: 4, lineHeight: 1.4,
                maxWidth: 260,
              }}>{subtitle}</p>
            )}
          </div>

          {/* Clerk component slot */}
          <div className="sophia-auth-card" style={{ width: "100%", overflow: "hidden" }}>
            {children}
          </div>

          {/* Footer */}
          <p style={{
            marginTop: 16, textAlign: "center",
            fontSize: 11, color: "rgba(255,255,255,0.35)",
            fontFamily: "'Tomorrow', sans-serif",
            lineHeight: 1.5,
          }}>
            By continuing, you agree to our Terms of Service
          </p>
        </div>
      </div>
    </div>
  );
};

export default AuthLayout;
