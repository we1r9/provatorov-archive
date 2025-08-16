// Вытаскиваем нужные поля из photos.json и формируем объект
export function mapPhotos(photos) {
  return photos.map(item => {
    const hasRegion = item.location && item.location.region;
    const hasCountry = item.location && item.location.country;

    const region = hasRegion ? item.location.region : '';
    const country = hasCountry ? item.location.country : '';

    let location = '';
    if (region && country) location = region + ' • ' + country;
    else if (region) location = region;
    else if (country) location = country;
    else location = '';

    return {
      id: item.id,
      year: item.date.split('-')[0],
      month: item.date.split('-')[1] || '',
      region,
      country,
      location,
      tags: item.tags || [],
      thumb: item.files.thumb,
      web: item.files.web,
      hq: item.files.hq || null,
      description: item.description || '',
      cameraModel: (item.camera && item.camera.model) || '',
      cameraLens: (item.camera && item.camera.lens) || '',
      cameraFocalLength: (item.camera && item.camera.focal_length_mm) || '',
      cameraAperture: (item.camera && item.camera.aperture_f) || '',
      cameraShutter: (item.camera && item.camera.shutter) || '',
      cameraIso: (item.camera && item.camera.iso) || ''
    };
  });
}