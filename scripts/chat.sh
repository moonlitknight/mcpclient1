#!/bin/bash
# This script is used to submit an http request to the chat server.
# An example is curl -X POST -H 'Content-Type: application/json' -d '{"text":"This is the prompt", "supabase_jwt":"test2", "temperature":1, "stream":true}' -v localhost:3001/chat
# The command line args are `chat.sh prop1=value1 prop2=value2 ... text`
# An arg parameter is identified by it being a the front of the arg list, and it is a key-value pair separated by an equal sign and not containing and spaces.
# Once all arg parameters are parsed, the rest of the args are considered the text prompt.
#
#
# Usage: chat.sh [prop1=value1] [prop2=value2] ... text goes here

# Initialize variables
supabase_jwt="test1"
temperature="1"
stream="false"
text=""

# Process property arguments
while [ $# -gt 0 ] && [[ "$1" == *=* ]]; do
  key="${1%%=*}"
  value="${1#*=}"
  case $key in
    supabase_jwt)
      supabase_jwt="$value"
      ;;
    temperature)
      temperature="$value"
      ;;
    stream)
      stream="$value"
      ;;
    *)
      echo "Unknown argument: $key"
      exit 1
      ;;
  esac
  shift
done

# Remaining arguments are the text
text="$*"

# now construct the curl command
set -x
curl -X POST -H 'Content-Type: application/json' \
  -d "{\"text\":\"$text\", \"supabase_jwt\":\"$supabase_jwt\", \"temperature\":$temperature, \"stream\":$stream}" \
  -v localhost:3001/chat
