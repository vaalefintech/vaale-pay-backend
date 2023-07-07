const fs = require('fs');
const path = require('path');
const exec = require('child_process').exec;
const zip = require('gulp-zip');
const gulp = require('gulp');

async function copyDir(src, dest) {
    return new Promise(async (resolve, reject) => {
        const copy = async (copySrc, copyDest) => {
            console.log(`copy ${copySrc} ${copyDest}`);
            return new Promise(async (resolve2, reject2) => {
                try {
                    const list = fs.readdirSync(copySrc);
                    const promesas = [];
                    list.forEach(async (item) => {
                        const ss = path.resolve(copySrc, item);
                        try {
                            const stat = fs.statSync(ss);
                            const curSrc = path.resolve(copySrc, item);
                            const curDest = path.resolve(copyDest, item);
                            if (stat.isFile()) {
                                promesas.push(new Promise((resolve3, reject3) => {
                                    const stream = fs.createReadStream(curSrc)
                                        .pipe(fs.createWriteStream(curDest));
                                    stream.on('error', reject3);
                                    stream.on('finish', resolve3);
                                }));
                            } else if (stat.isDirectory()) {
                                fs.mkdirSync(curDest, { recursive: true });
                                await copy(curSrc, curDest);
                            }
                        } catch (err2) {
                            reject2(err2);
                        }
                    });
                    try {
                        await Promise.all(promesas);
                        resolve2();
                    } catch (err3) {
                        reject2(err3);
                    }
                } catch (err1) {
                    reject2(err1);
                }
            });
        };

        try {
            await createFolderIfNotExists(dest);
            await copy(src, dest);
            resolve();
        } catch (err0) {
            reject(err0);
        }
    });
};

async function runCommand(command, workingDirectory = "./") {
    return new Promise((resolve, reject) => {
        console.log(`Running ${command} at ${workingDirectory}`);
        exec(command, {
            cwd: workingDirectory
        }, function (err, stdout, stderr) {
            console.log(stdout);
            if (err !== null) {
                reject(err);
            } else {
                resolve();
            }
        });
    });
}

async function removeDir(path) {
    return new Promise((resolve, reject) => {
        try {
            if (fs.existsSync(path)) {
                const files = fs.readdirSync(path)

                if (files.length > 0) {
                    files.forEach(function (filename) {
                        if (fs.statSync(path + "/" + filename).isDirectory()) {
                            removeDir(path + "/" + filename)
                        } else {
                            fs.unlinkSync(path + "/" + filename)
                        }
                    })
                } else {
                    console.log("No files found in the directory.")
                }
                fs.rmdirSync(path);
            } else {
                console.log("Directory path not found.")
            }
            resolve();
        } catch (err) {
            reject(err);
        }
    });

}

const destDir = "./build";
const distDir = "./dist";
const zipsDir = "./zips";

async function recreateDistFolder() {
    await removeDir(distDir);
    await runCommand("npx tsc");
}

async function generateZip() {
    await recreateDistFolder();
    await removeDir(destDir);
    await createFolderIfNotExists(destDir);
    fs.copyFileSync("package.json", `${destDir}/package.json`);
    await runCommand("npm install --only=production", destDir);
    await copyDir(distDir, `${destDir}/dist`);
    await comprimirBuild();
}

async function simpleZip() {
    const distCopy = `${destDir}/dist`;
    await removeDir(distCopy);
    await copyDir(distDir, distCopy);
    await comprimirBuild();
}

function lPad2(n) {
    return ('0' + n).slice(-2);
}

function toAAAAMMDDHHmmss() {
    const siguiente = new Date();
    const anio1 = siguiente.getFullYear();
    const mes1 = siguiente.getMonth() + 1;
    const dia1 = siguiente.getDate();
    const hora = siguiente.getHours();
    const minutos = siguiente.getMinutes();
    const segundos = siguiente.getSeconds();
    return `${anio1}${lPad2(mes1)}${lPad2(dia1)}_${lPad2(hora)}${lPad2(minutos)}${lPad2(segundos)}`;
}

async function createFolderIfNotExists(myDir) {
    return new Promise((resolve, reject) => {
        try {
            if (!fs.existsSync(myDir)) {
                fs.mkdirSync(myDir);
            }
            resolve();
        } catch (err) {
            reject(err);
        }
    });

}

async function comprimirBuild() {
    return new Promise(async (resolve, reject) => {
        await createFolderIfNotExists(zipsDir);
        const suffix = toAAAAMMDDHHmmss();
        const outputFile = `build_${suffix}.zip`;
        console.log("To deploy use:");
        console.log(`terraform apply -var zipfile=".${zipsDir}/${outputFile}"`);
        gulp.src(`${destDir}/**`)
            .pipe(zip(outputFile))
            .pipe(gulp.dest(zipsDir))
            .on('error', reject)
            .on('end', resolve);
    });
};

async function clean() {
    await removeDir(destDir);
    await removeDir(zipsDir);
}

exports.clean = clean;
exports.dist = recreateDistFolder;
exports.generate_all = generateZip;
exports.zip = comprimirBuild;
exports.transpyle = recreateDistFolder;
exports.default = simpleZip;