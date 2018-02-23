#!/bin/sh

# dumb helper script to generate the "files" section of the configuration

echo '"files": ['
find content.orig -type f | awk '{if(NR!=1)c=",";} {print c "\"" $0 "\""}'
echo ']'
