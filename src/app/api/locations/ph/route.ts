import { NextResponse } from 'next/server';
const psgc = require('psgc');

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get('type');
  const province = searchParams.get('province');
  const municipality = searchParams.get('municipality');

  try {
    // 1. Get all 85 provinces (sorted)
    if (type === 'provinces') {
      const allProvinces = psgc.provinces.all().map((p: any) => ({
        name: p.name,
        region: p.region,
      })).sort((a: any, b: any) => a.name.localeCompare(b.name));

      return NextResponse.json({ provinces: allProvinces });
    }

    // 2. Get all municipalities and cities for selected province
    if (type === 'municipalities' && province) {
      const allMuni = psgc.municipalities.all();
      const provLower = province.toLowerCase();

      const filtered = allMuni
        .filter((m: any) => {
          if (!m.province) return false;
          const mp = m.province.toLowerCase();
          return mp === provLower || mp.includes(provLower) || provLower.includes(mp);
        })
        .map((m: any) => {
          let displayName = m.name;
          if (m.city && !displayName.toLowerCase().includes('city')) {
            displayName = `${m.name} City`;
          }
          return {
            name: displayName,
            rawName: m.name,
            city: m.city,
          };
        })
        .sort((a: any, b: any) => a.name.localeCompare(b.name));

      return NextResponse.json({ municipalities: filtered });
    }

    // 3. Get all barangays for selected city / municipality
    if (type === 'barangays' && municipality) {
      const allB = psgc.barangays.all();
      
      // If Metro Manila and City of Manila
      if (province && province.toLowerCase().includes('manila') && (municipality.toLowerCase() === 'manila' || municipality.toLowerCase() === 'manila city')) {
        const manilaBrgys = allB
          .filter((b: any) => String(b.code).startsWith('1339'))
          .map((b: any) => b.name)
          .sort((a: string, b: string) => a.localeCompare(b));
        return NextResponse.json({ barangays: Array.from(new Set(manilaBrgys)) });
      }

      const cleanMuni = municipality.toLowerCase().replace(/city|capital|of|\(|\)/g, '').trim();

      let matches = allB.filter((b: any) => {
        if (!b.citymun) return false;
        const cleanB = b.citymun.toLowerCase().replace(/city|capital|of|\(|\)/g, '').trim();
        return cleanB === cleanMuni;
      });

      if (matches.length === 0) {
        matches = allB.filter((b: any) => {
          if (!b.citymun) return false;
          const cleanB = b.citymun.toLowerCase().replace(/city|capital|of|\(|\)/g, '').trim();
          return cleanB.includes(cleanMuni) || cleanMuni.includes(cleanB);
        });
      }

      const brgyNames = Array.from(new Set(matches.map((b: any) => b.name))).sort((a: any, b: any) => a.localeCompare(b));

      return NextResponse.json({ barangays: brgyNames });
    }

    return NextResponse.json({ error: 'Invalid query parameters' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
