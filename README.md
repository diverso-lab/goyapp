# Goyapp - Generador de pósters para eventos

Este generador de pósters convierte información de eventos, proporcionada en formato Markdown, en pósters visuales en formatos SVG, PNG, JPG, PDF, EPS y PS

## Configuración del Entorno Virtual

1. **Crear el entorno virtual**:

```
python -m venv venv
```

2. **Activar el entorno virtual**:

   - En Windows: `.\venv\Scripts\activate`
   - En macOS y Linux: `source venv/bin/activate`

## Instalación de Dependencias

Instala las dependencias necesarias con el comando:

```
pip install -r requirements.txt
```

## Definición del Markdown

En `markdowns/example.md` puedes definir qué información quieres mostrar en el póster


## Ejecución del Generador

Para ejecutar el generador, utiliza el comando:

```
python main.py
```

# Archivos Generados por el Script

Al ejecutar el script, se generarán los siguientes archivos en la carpeta `posters`, organizados en subcarpetas nombradas según el archivo Markdown de origen:

- `posters/{nombre_del_md}/{nombre_del_md}.svg`: Este es el póster original generado en formato SVG, donde `{nombre_del_md}` es el nombre del archivo Markdown de origen sin la extensión `.md`.

- `posters/{nombre_del_md}/{nombre_del_md}.png`: Este archivo es la conversión del póster a formato PNG, ubicado en la misma subcarpeta que el archivo SVG.

- `posters/{nombre_del_md}/{nombre_del_md}.jpg`: Similar al archivo PNG, esta es la versión del póster en formato JPG.

- `posters/{nombre_del_md}/{nombre_del_md}.pdf`: El póster también se convierte a formato PDF, facilitando su impresión o distribución en un formato ampliamente utilizado.

- `posters/{nombre_del_md}/{nombre_del_md}.eps`: Para aplicaciones que requieren formatos de gráficos vectoriales, el póster se convierte a formato EPS.

- `posters/{nombre_del_md}/{nombre_del_md}.ps`: Finalmente, se genera una versión del póster en formato PostScript (PS), adecuado para ciertos entornos de impresión profesional.

Cada archivo se almacena dentro de una subcarpeta específica en `posters`, asegurando una organización clara y facilitando el acceso a los pósters generados para cada evento descrito en los archivos Markdown.
