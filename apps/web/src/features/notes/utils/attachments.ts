export function appendImageToContent(content: string, imageSrc: string, altText = 'Attached image'): string {
  const imageMarkup = `<p><img src="${imageSrc}" alt="${altText}" /></p>`;

  if (!content.trim()) {
    return imageMarkup;
  }

  return `${content}${content.endsWith('</p>') ? '' : '<p></p>'}${imageMarkup}`;
}
