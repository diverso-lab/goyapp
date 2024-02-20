# Goyapp - Generador de pósters para eventos

Este generador de pósters convierte información de eventos, proporcionada en formato Markdown, en pósters visuales en formatos SVG, PNG y JPG.

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

## Ejecución del Generador

Para ejecutar el generador, utiliza el comando:

```
python main.py
```


## Archivos Generados

El script generará los siguientes archivos:

- `your_poster.svg`: El póster en formato SVG.
- `your_poster.png`: El póster convertido a formato PNG.
- `your_poster.jpg`: El póster convertido a formato JPG.
