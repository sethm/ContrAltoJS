/*
 JsAlto Xerox Alto Emulator
 Copyright (C) 2016  Seth J. Morabito

 This program is free software: you can redistribute it and/or modify
 it under the terms of the GNU Affero General Public License as published by
 the Free Software Foundation, either version 3 of the License, or
 (at your option) any later version.

 This program is distributed in the hope that it will be useful,
 but WITHOUT ANY WARRANTY; without even the implied warranty of
 MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 GNU Affero General Public License for more details.

 You should have received a copy of the GNU Affero General Public License
 along with this program.  If not, see
 <http://www.gnu.org/licenses/>.
*/

/*
 * ROM UTIL
 *
 * This utility was used to translate raw ALTO II ROM files into
 * JavaScript objects.
 *
 */

#include <stdio.h>
#include <string.h>
#include <unistd.h>

#define MAX_FILES 16
#define PATH_LEN 255
#define C_LEN 256
#define NUM_C_FILES 4
#define U_LEN 2048
#define U_FILE_LEN 1024
#define NUM_U_FILES  16
#define INVERTED_BIT_MASK 0xfff77bff

/* Forward declarations */
void usage();
int addr_map_c(int addr);
int addr_map_acs(int addr);
int data_map(int input);
int load_crom(char *dir);
int load_urom(char *dir);
int load_acsource(char *dir);
unsigned int map_word(unsigned int word);

void usage() {
    printf("Usage: romutil -c [dir]\n"
           "       romutil -a [dir]\n"
           "       romutil -u [dir]\n");
    printf("\n");
    printf("   -c [dir]   Constant ROM directory\n");
    printf("   -a [dir]   AC Source ROM directory\n");
    printf("   -u [dir]   Microcode ROM directory\n");
}

unsigned int map_word(unsigned int word) {
    unsigned int masked = word & ~INVERTED_BIT_MASK;
    word = ((~word) & INVERTED_BIT_MASK) | masked;
    return word;
}

/* Deal with the Alto ROM's INSANE address mapping */
int addr_map_c(int addr) {
    int i;
    int mapped_address = 0;
    int address_mapping[] = {7, 2, 1, 0, 3, 4, 5, 6};

    for (i = 0; i < 8; i++) {
        if ((addr & (1 << i)) != 0) {
            mapped_address |= (1 << address_mapping[i]);
        }
    }

    return mapped_address;
}

int addr_map_acs(int data) {
    int i;
    int mapped_data = 0;

    for (i = 0; i < 8; i++) {
        if ((data & (1 << i)) != 0) {
            mapped_data |= (1 << (7 - i));
        }
    }

    return (~mapped_data) & 0xff;
}

unsigned int addr_map_u(unsigned int address) {
    int mapped_address = (~address) & 0x3ff;
    return mapped_address;
}

int data_map(int data) {
    int i, mapped_data = 0;

    for (i = 0; i < 4; i++) {
        if ((data & (1 << i)) != 0) {
            mapped_data |= (1 << (3-i));
        }
    }

    return mapped_data;
}

void trim_path(char *dir) {
    int dirlen = strlen(dir);

    /* Strip off trailing slash (if any) */
    if (dir[dirlen - 1] == '/') {
        dir[dirlen - 1] = 0;
    }
}


int load_crom(char *dir) {
    int i, j;
    char fnames[NUM_C_FILES][PATH_LEN];
    FILE *fp = NULL;
    int flen;

    /* Holds the loaded raw ROM files */
    char data[NUM_C_FILES][C_LEN];

    /* Holds the finished, OR-ed ROM image */
    unsigned short rom[C_LEN];

    trim_path(dir);

    snprintf(fnames[0], PATH_LEN, "%s/C0", dir);
    snprintf(fnames[1], PATH_LEN, "%s/C1", dir);
    snprintf(fnames[2], PATH_LEN, "%s/C2", dir);
    snprintf(fnames[3], PATH_LEN, "%s/C3", dir);

    for (i = 0; i < NUM_C_FILES; i++) {
        fp = fopen(fnames[i], "r");

        if (fp == NULL) {
            fprintf(stderr, "Can't find file %s. Aborting.\n", fnames[i]);
            return 1;
        }

        /* Ensure the file is C_LEN bytes long */
        fseek(fp, 0L, SEEK_END);
        flen = ftell(fp);
        rewind(fp);

        if (flen != C_LEN) {
            fclose(fp);
            fprintf(stderr, "ROM file %s is not 256 bytes long. Aborting.\n", fnames[i]);
            return 1;
        }

        fread(data[i], C_LEN, 1, fp);

        fclose(fp);
    }

    /* At this point we should have all ROM files loaded into c_files,
       so we can go ahead and OR them together */

    for (i = 0; i < NUM_C_FILES; i++) {
        for (j = 0; j < C_LEN; j++) {
            rom[j] |= data_map(data[i][addr_map_c(j)] & 0xf) << (12 - (4 * i));
        }
    }

    /* Finally, invert all bits */
    for (i = 0; i < C_LEN; i++) {
        rom[i] = ~rom[i];
    }


    /* Do output */

    printf("var CROM = [");

    for (i = 0; i < C_LEN; i++) {
        printf("0x%04x", rom[i]);

        if (i < C_LEN - 1) {
            if ((i+1) % 8 == 0) {
                printf(",\n            ");
            } else {
                printf(", ");
            }
        }
    }

    printf("];\n");

    return 0;
}

int load_urom(char *dir) {
    int i, j;
    char fnames[NUM_U_FILES][PATH_LEN];
    FILE *fp = NULL;
    int flen;

    /* Holds the loaded raw ROM files */
    char data[NUM_U_FILES][U_FILE_LEN];

    /* Holds the finished, OR-ed 2K ROM image */
    unsigned int rom[U_LEN];

    trim_path(dir);

    // First 1K
    snprintf(fnames[0], PATH_LEN, "%s/U55", dir);
    snprintf(fnames[1], PATH_LEN, "%s/U64", dir);
    snprintf(fnames[2], PATH_LEN, "%s/U65", dir);
    snprintf(fnames[3], PATH_LEN, "%s/U63", dir);
    snprintf(fnames[4], PATH_LEN, "%s/U53", dir);
    snprintf(fnames[5], PATH_LEN, "%s/U60", dir);
    snprintf(fnames[6], PATH_LEN, "%s/U61", dir);
    snprintf(fnames[7], PATH_LEN, "%s/U62", dir);

    // Second 1K - MESA 5.0
    snprintf(fnames[8],  PATH_LEN, "%s/U54", dir);
    snprintf(fnames[9],  PATH_LEN, "%s/U74", dir);
    snprintf(fnames[10], PATH_LEN, "%s/U75", dir);
    snprintf(fnames[11], PATH_LEN, "%s/U73", dir);
    snprintf(fnames[12], PATH_LEN, "%s/U52", dir);
    snprintf(fnames[13], PATH_LEN, "%s/U70", dir);
    snprintf(fnames[14], PATH_LEN, "%s/U71", dir);
    snprintf(fnames[15], PATH_LEN, "%s/U72", dir);

    // Load the raw files
    for (i = 0; i < NUM_U_FILES; i++) {
        fp = fopen(fnames[i], "r");

        if (fp == NULL) {
            fprintf(stderr, "Can't find file %s. Aborting.\n", fnames[i]);
            return 1;
        }

        /* Ensure the file is C_LEN bytes long */
        fseek(fp, 0L, SEEK_END);
        flen = ftell(fp);
        rewind(fp);

        if (flen != U_FILE_LEN) {
            fclose(fp);
            fprintf(stderr, "ROM file %s is not 1024 bytes long. Aborting.\n", fnames[i]);
            return 1;
        }

        fread(data[i], U_FILE_LEN, 1, fp);

        fclose(fp);
    }

    /* At this point we should have all ROM files loaded into c_files,
       so we can go ahead and OR them together */

    /* First 8 files go into the lower 1K */
    for (i = 0; i < 8; i++) {
        /* Lower 1K */
        for (j = 0; j < 1024; j++) {
            rom[j] |= (data[i][addr_map_u(j)] & 0xf) << (28 - (4 * i));
        }
    }

    for (i = 8; i < 16; i++) {
        /* upper 1K */
        for (j = 0; j < 1024; j++) {
            rom[j + 1024] |= (data[i][addr_map_u(j)] & 0xf) << (28 - (4 * i));
        }
    }

    /* Now map the words. */
    for (i = 0; i < 2048; i++) {
        rom[i] = map_word(rom[i]);
    }

    /* Now do output */
    printf("var UROM = [");

    for (i = 0; i < U_LEN; i++) {
        printf("0x%08x", rom[i]);

        if (i < U_LEN - 1) {
            if ((i+1) % 8 == 0) {
                printf(",\n            ");
            } else {
                printf(", ");
            }
        }
    }

    printf("];\n");

    return 0;
}


int load_acsource(char *dir) {
    FILE *fp;
    int flen;
    int i;
    char fname[PATH_LEN];
    char data[256];
    char rom[256];

    trim_path(dir);

    snprintf(fname, PATH_LEN, "%s/ACSOURCE.NEW", dir);

    fp = fopen(fname, "r");

    if (fp == NULL) {
        fprintf(stderr, "Can't find file %s. Aborting.\n", fname);
        return 1;
    }

    /* Ensure the file is 256 bytes long */
    fseek(fp, 0L, SEEK_END);
    flen = ftell(fp);
    rewind(fp);

    if (flen != 256) {
        fclose(fp);
        fprintf(stderr, "ROM file %s is not 256 bytes long. Aborting.\n", fname);
        return 1;
    }

    fread(data, C_LEN, 1, fp);
    fclose(fp);

    /* ROM file is loaded into data */
    for (int i = 0; i < 256; i++) {
        rom[i] = ~data_map(data[addr_map_acs(i)]) & 0xf;
    }

    /* Do output */

    printf("var ACSROM = [");

    for (i = 0; i < C_LEN; i++) {
        printf("0x%02x", rom[i]);

        if (i < C_LEN - 1) {
            if ((i+1) % 8 == 0) {
                printf(",\n              ");
            } else {
                printf(", ");
            }
        }
    }

    printf("];\n");


    return 0;
}

int main(int argc, char **argv) {
    int constant_flag = 0, ucode_flag = 0, acsource_flag = 0;
    int c, i;
    char *dir = NULL;

    if (argc < 2) {
        usage();
        return 1;
    }

    while ((c = getopt(argc, argv, "a:c:u:")) != -1) {
        switch (c) {
        case 'a':
            acsource_flag = 1;
            dir = optarg;
            break;
        case 'c':
            constant_flag = 1;
            dir = optarg;
            break;
        case 'u':
            ucode_flag = 1;
            dir = optarg;
            break;
        case '?':
            usage();
            return 1;
        }
    }

    if (constant_flag) {
        return load_crom(dir);
    } else if (ucode_flag) {
        return load_urom(dir);
    } else if (acsource_flag) {
        return load_acsource(dir);
    } else {
        usage();
        return 1;
    }
}
