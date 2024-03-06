import markdown
from bs4 import BeautifulSoup
import xml.etree.ElementTree as ET
import cairosvg
import os
import glob

def update_svg_text(root, namespaces, element_id, new_text):
    lines = new_text.upper().split('\n')
    tspan_elements = root.findall(f".//svg:tspan[@class='{element_id}']", namespaces)
    tspan_to_keep = tspan_elements[:len(lines)]

    for tspan, line in zip(tspan_to_keep, lines):
        tspan.text = line

    for parent in root.findall(".//svg:tspan", namespaces):
        for child in list(parent):
            if child in tspan_elements and child not in tspan_to_keep:
                parent.remove(child)

def process_markdown_file(markdown_file_path, svg_template_path, output_base_name):
    # Crear la carpeta de destino si no existe
    output_folder = os.path.join('posters', output_base_name)
    os.makedirs(output_folder, exist_ok=True)

    with open(markdown_file_path, 'r') as file:
        text = file.read()
        md = markdown.Markdown()
        html = md.convert(text)
        soup = BeautifulSoup(html, 'html.parser')

        event_title = soup.find('h2').find_next('p').text.strip()
        event_date_time = soup.find('h2').find_next('p').find_next('p').text.strip()
        event_location = soup.find('h2').find_next('p').find_next('p').find_next('p').text.strip()
        speaker = soup.find('h2').find_next('p').find_next('p').find_next('p').find_next('p').text.strip()

    tree = ET.parse(svg_template_path)
    root = tree.getroot()
    namespaces = {'svg': 'http://www.w3.org/2000/svg'}

    update_svg_text(root, namespaces, 'title', event_title)
    update_svg_text(root, namespaces, 'datetime', event_date_time)
    update_svg_text(root, namespaces, 'location', event_location)
    update_svg_text(root, namespaces, 'speaker', speaker)

    svg_output_path = os.path.join(output_folder, f'{output_base_name}.svg')
    tree.write(svg_output_path)

    dpi = 300
    cairosvg.svg2png(url=svg_output_path, write_to=os.path.join(output_folder, f'{output_base_name}.png'), dpi=dpi)
    cairosvg.svg2png(url=svg_output_path, write_to=os.path.join(output_folder, f'{output_base_name}.jpg'), dpi=dpi)
    cairosvg.svg2pdf(url=svg_output_path, write_to=os.path.join(output_folder, f'{output_base_name}.pdf'))
    cairosvg.svg2eps(url=svg_output_path, write_to=os.path.join(output_folder, f'{output_base_name}.eps'))
    cairosvg.svg2ps(url=svg_output_path, write_to=os.path.join(output_folder, f'{output_base_name}.ps'))

# Definir la ruta a la carpeta que contiene los archivos Markdown
markdown_folder_path = 'markdowns'

# Ruta de la plantilla SVG
svg_template_path = 'poster_template_16_9.svg'

# Utilizar glob para encontrar todos los archivos .md en la carpeta
markdown_files = glob.glob(os.path.join(markdown_folder_path, '*.md'))

# Procesar cada archivo Markdown
if markdown_files:
    for markdown_file in markdown_files:
        output_base_name = os.path.splitext(os.path.basename(markdown_file))[0]  # Obtener el nombre base para los archivos de salida
        process_markdown_file(markdown_file, svg_template_path, output_base_name)
else:
    print("No se encontraron archivos Markdown en la carpeta especificada.")
