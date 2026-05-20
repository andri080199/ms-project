// Daftar nama departemen kanonik yang dipakai di seluruh form admin dan filter.
// Gunakan daftar ini sebagai sumber kebenaran tunggal agar konsisten di semua tempat.
export const DEPARTMENTS = [
  'Board', // Dewan Direksi
  'OPS - General Support', // Operasional - Dukungan Umum
  'OPS - Project', // Operasional - Proyek
  'People & Culture', // HR / People & Culture
  'Technology', // Divisi Teknologi
] as const; // 'as const' membuat array menjadi readonly tuple dengan literal types

// Daftar opsi yang kompatibel dengan Select Ant Design — format { value, label }.
// Langsung bisa dipass ke prop `options` pada komponen Select AntD.
export const DEPARTMENT_OPTIONS = DEPARTMENTS.map((d) => ({ value: d, label: d }));
