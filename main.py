import markdown
from bs4 import BeautifulSoup
import xml.etree.ElementTree as ET
import cairosvg

def update_svg_text(element_id, new_text):

    # Dividir el título en líneas
    lines = new_text.upper().split('\n')

    # Encontrar todos los elementos tspan con la clase {element_id}
    tspan_elements = root.findall(f".//svg:tspan[@class='{element_id}']", namespaces)

    # Extraer los elementos tspan que se deben conservar basándose en el número de líneas
    tspan_to_keep = tspan_elements[:len(lines)]

    # Iterar sobre los elementos tspan filtrados y las líneas y asignar el texto
    for tspan, line in zip(tspan_to_keep, lines):
        tspan.text = line

    # Encontrar y eliminar los elementos tspan no necesarios
    for parent in root.findall(".//svg:tspan", namespaces):
        for child in list(parent):  # Usar list(parent) para evitar modificar la lista sobre la que se itera
            if child in tspan_elements and child not in tspan_to_keep:
                parent.remove(child)

# Definir la ruta al archivo markdown y la plantilla SVG
markdown_file_path = 'event_details.md'
svg_template_path = 'poster_template.svg'

# Leer el archivo markdown y extraer la información
with open(markdown_file_path, 'r') as file:
    text = file.read()
    md = markdown.Markdown()
    html = md.convert(text)

    # Convertir el HTML a un objeto BeautifulSoup para facilitar la extracción
    soup = BeautifulSoup(html, 'html.parser')

    # Extraer la información del evento del HTML convertido
    event_title = soup.find('h2').find_next('p').text.strip()
    event_date_time = soup.find('h2').find_next('p').find_next('p').text.strip()
    event_location = soup.find('h2').find_next('p').find_next('p').find_next('p').text.strip()
    speaker = soup.find('h2').find_next('p').find_next('p').find_next('p').find_next('p').text.strip()

# Cargar la plantilla SVG
tree = ET.parse(svg_template_path)
root = tree.getroot()
namespaces = {'svg': 'http://www.w3.org/2000/svg'}

update_svg_text('title', event_title)
update_svg_text('datetime', event_date_time)
update_svg_text('location', event_location)
update_svg_text('speaker', speaker)


# Guardar el SVG modificado
tree.write('your_poster.svg')

# Convertir y guardar el SVG como PNG
cairosvg.svg2png(url='your_poster.svg', write_to='your_poster.png')

# Convertir y guardar el SVG como JPG
cairosvg.svg2png(url='your_poster.svg', write_to='your_poster.jpg')
