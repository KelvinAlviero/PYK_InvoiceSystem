// Loads a small sample of regions so the registration form works in development
// (the same places the old hardcoded dropdown had). Replace with the full official
// Kemendagri dataset before real use. Safe to re-run.
//
// Province and city ids are the real Kemendagri codes. Sample village ids use
// district "00" (e.g. 3273000001), which no real village code uses, so they never
// collide with the official data later.
import { pool } from '../db.js';

const sample = {
    32: ['Jawa Barat', {
        3273: ['Kota Bandung', ['Coblong', 'Sukajadi']],
        3204: ['Kabupaten Bandung', ['Baleendah', 'Cileunyi']]
    }],
    33: ['Jawa Tengah', {
        3374: ['Kota Semarang', ['Banyumanik', 'Tembalang']],
        3322: ['Kabupaten Semarang', ['Bergas', 'Ungaran']]
    }]
};

for (const [provinceId, [provinceName, cities]] of Object.entries(sample)) {
    await pool.query('INSERT INTO provinces (id, name) VALUES ($1, $2) ON CONFLICT DO NOTHING', [provinceId, provinceName]);

    for (const [cityId, [cityName, villages]] of Object.entries(cities)) {
        await pool.query(
            'INSERT INTO cities (id, province_id, name) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
            [cityId, provinceId, cityName]
        );

        for (const [index, villageName] of villages.entries()) {
            const villageId = Number(cityId) * 1_000_000 + index + 1;
            await pool.query(
                'INSERT INTO villages (id, city_id, name) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
                [villageId, cityId, villageName]
            );
        }
    }
}

console.log('Sample regions loaded.');
await pool.end();
