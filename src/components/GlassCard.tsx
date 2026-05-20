import type { CSSProperties, ReactNode } from 'react'; // tipe React untuk children dan style

// Tipe props komponen GlassCard
type Props = {
  children: ReactNode; // konten yang dibungkus dalam card
  className?: string; // kelas CSS tambahan dari parent (misal: "p-5 space-y-4")
  style?: CSSProperties; // style inline opsional dari parent
  // Jika true, tambahkan efek brightness/lift saat hover via kelas `glass-hover`
  // Dipakai untuk card yang bisa diklik (interaktif)
  hover?: boolean;
};

// Kontainer card glass-morphism generik. Menerapkan kelas CSS global `.glass`
// dan opsional `.glass-hover` untuk card yang bisa diinteraksi.
// Dipakai di seluruh aplikasi sebagai wrapper section pada halaman dan modal.
export default function GlassCard({ children, className = '', style, hover = false }: Props) {
  return (
    // Div dengan kelas .glass (background blur + border transparan)
    // + .glass-hover (efek brightness/shadow saat hover, jika prop hover=true)
    // + className tambahan dari parent
    <div className={`glass ${hover ? 'glass-hover' : ''} ${className}`} style={style}>
      {children} {/* render konten yang diberikan dari parent */}
    </div>
  );
}
