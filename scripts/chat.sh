#!/bin/bash
# 
# @file chat.sh
# @brief Script for submitting HTTP requests to the chat server
# @description
#   This script allows sending chat requests to the server with various parameters.
#   It supports both streaming and non-streaming responses, and includes tool definitions
#   for function calling capabilities.
#
# An example is curl -X POST -H 'Content-Type: application/json' -d '{"text":"This is the prompt", "supabase_jwt":"test2", "temperature":1, "stream":true}' -v localhost:3001/chat
# The command line args are `chat.sh prop1=value1 prop2=value2 ... text`
# An arg parameter is identified by it being a the front of the arg list, and it is a key-value pair separated by an equal sign and not containing and spaces.
# Once all arg parameters are parsed, the rest of the args are considered the text prompt.
#
#
# Usage: chat.sh [prop1=value1] [prop2=value2] ... text goes here

# Initialize variables
supabase_jwt="roy.smith.esq%2Baccounts@gmail.com"
temperature="1"
stream="false"
text=""


TOOL_JSON=$(cat <<'EOF'
[

{
    "type": "function",
    "name": "post_journal_entry",
    "description": "Posts a journal entry to the account system nominal ledger.",
    "parameters": {
        "type": "object",
        "properties": {
            "debit_account_number": {
                "type": "string",
                "description": "The nnn or nnn.n format nominal account number to debit."
            },
            "credit_account_number": {
                "type": "string",
                "description": "The nnn or nnn.n format nominal account number to credit."
            },
            "effective_date": {
                "type": "string",
                "description": "The date the journal entry is effective."
            },
            "amount": {
                "type": "number",
                "description": "The amount in euros to debit or credit."
            }
        },
        "required": ["debit_account_number", "credit_account_number", "effective_date", "amount"],
        "additionalProperties": false
    },
    "strict": true
    }
    ,
    {
        "type": "function",
        "name": "get_trial_balance",
        "description": "Retrieves the trial balance between the supplied dates. Format is a TSV table with headers: account_number, account_name, openning_balance, period_debits, period_credits, closing_balance. To obtain the current balance, use the start_date as the first day of this calendar year and the end_date as today.",
        "parameters": {
            "type": "object",
            "properties": {
                "start_date": {
                    "type": "string",
                    "description": "The start date for the trial balance in YYYY-MM-DD format. Typically the first day of the financial year. Format is YYYY-MM-DD."
                },
                "end_date": {
                    "type": "string",
                    "description": "The end date for the trial balance in YYYY-MM-DD format. Typically the last day of the financial year. Format is YYYY-MM-DD."
                }
            },
            "required": ["start_date", "end_date"],
            "additionalProperties": false
        },
        "strict": true
    }

]
EOF
)

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
# set -x

response=$(curl -v -s -X POST -H 'Content-Type: application/json' \
  -d @- <<EOF \
  localhost:3001/chat?t=$supabase_jwt
{
  "text": "$text",
  "temperature": $temperature,
  "stream": $stream,
  "tools": $TOOL_JSON
}
EOF
)

# Print raw response for debugging
echo "Raw response:"
echo "$response"

# Extract and print response content if present
  echo -e "\n ===================== Response content: ======================"
  echo "$response" | jq -r '.output_text'
  echo -e "\n =============================================================="
