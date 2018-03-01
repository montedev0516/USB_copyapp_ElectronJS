#!/usr/bin/awk -f

# dumb helper script to generate the "files" section of the configuration

BEGIN { print "\"files\": ["; }
{
    if(NR!=1)c=",";
}
{
    print c "\"" $0 "\""
}
END { print "]" }
