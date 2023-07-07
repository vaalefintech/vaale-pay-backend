# app-vaale-back
app-vaale-back

git config --global user.name "Edgar Delgado"
git config --global user.email "edgar.jose.fernando.delgado@gmail.com"

git clone git@github.com:ejfdelgado/app-vaale-back.git

terraform init
terraform plan
terraform destroy

terraform apply -var zipfile="../zips/build_20230705_183736.zip"

