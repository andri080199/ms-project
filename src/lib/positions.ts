// Daftar nama posisi/jabatan kanonik yang dipakai di seluruh form admin.
// Tambah atau hapus entri di sini saat struktur organisasi berubah.
export const POSITIONS = [
  'AI Software Engineer',
  'Associate Software Engineer',
  'CEO',
  'COO',
  'CTO',
  'Engineering Manager',
  'FAT Manager',
  'Full Stack Engineer',
  'Jr. Technical Project Manager',
  'Jr. TechOps',
  'Lead Product Manager',
  'OB',
  'People & GA Officer',
  'Product Manager',
  'Solution Engineer',
  'Solution Manager',
  'Sr. AI Software Engineer',
  'Sr. FAT',
  'Sr. Software Engineer',
  'Technical Project Manager',
  'Technical Project Manager Supervisor',
  'Vision AI Engineer',
] as const; // 'as const' membuat array menjadi readonly tuple dengan literal types

// Daftar opsi yang kompatibel dengan Select Ant Design — format { value, label }.
// Langsung bisa dipass ke prop `options` pada komponen Select AntD.
export const POSITION_OPTIONS = POSITIONS.map((p) => ({ value: p, label: p }));
