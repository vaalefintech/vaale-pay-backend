# app-vaale-back

## Ambiente de desarrollo

Instalar:

- Terraform >= 1.0.6
- node18, npm

Instalar las dependencias del proyecto:

```
npm install
npm install --global gulp-cli
```

## Generar el binario

Transpilar de typescript a javascript:
gulp generate_all
Importante, al final se generará un archivo \*.zip que queda en la carpeta ./zips

## Desplegar en AWS

Primero se deben asignar las dos variables de entorno:

```
export AWS_ACCESS_KEY_ID=XXXXXX
export AWS_SECRET_ACCESS_KEY=XXXXX
```

Luego, en la terminal se debe ubicar en la carpeta "terraform":

```
cd terraform
terraform init
terraform plan
```

Se debe ajustar el nombre del archivo \*.zip de acuerdo al paso de transpilar.

```
terraform apply -var zipfile="../zips/build_20230705_183736.zip"
```

Finalmente, si se desea destruir todo:

```
terraform destroy
```
