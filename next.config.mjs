/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  devIndicators: false,
  // Izinkan dev server diakses dari LAN (testing di HP via http://<IP>:3000).
  // Tanpa ini, Next 14+ block HMR socket & RSC streaming dari cross-origin,
  // bikin style AntD ga ke-inject sempurna alias tampilan berantakan.
  // Tambah IP spesifik kalau jaringan kamu di luar range RFC1918 di bawah.
  // Format = wildcard DNS-style (split per dot, '*' match satu segmen).
  // Bukan CIDR. Ini cover semua range RFC1918 IPv4.
  allowedDevOrigins: [
    '192.168.*.*',
    '10.*.*.*',
    '172.16.*.*',
    '172.17.*.*',
    '172.18.*.*',
    '172.19.*.*',
    '172.20.*.*',
    '172.21.*.*',
    '172.22.*.*',
    '172.23.*.*',
    '172.24.*.*',
    '172.25.*.*',
    '172.26.*.*',
    '172.27.*.*',
    '172.28.*.*',
    '172.29.*.*',
    '172.30.*.*',
    '172.31.*.*',
    '*.local',
  ],
};

export default nextConfig;
