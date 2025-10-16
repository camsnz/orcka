#!/bin/sh

set -eu

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
	echo "Error: must be run inside a git repository" >&2
	exit 1
fi

if [ "$#" -lt 1 ]; then
	echo "Usage: $0 <feature-name>" >&2
	exit 1
fi

input_name=$1

# Normalise the provided name into a branch-safe slug.
slug=$(printf "%s" "$input_name" | tr '[:upper:]' '[:lower:]' | tr ' ' '-' | tr -c 'a-z0-9-.' '-')
# Collapse duplicate separators and trim leading/trailing dashes.
slug=$(printf "%s" "$slug" | sed -e 's/-\{2,\}/-/g' -e 's/^[-.]*//' -e 's/[-.]*$//')

if [ -z "$slug" ]; then
	echo "Error: feature name must contain alphanumeric characters" >&2
	exit 1
fi

current_year=$(date +"%Y")
current_month=$(date +"%m")

# Convert to integers safely handling leading zeros.
current_year=$((10#$current_year))
current_month=$((10#$current_month))

next_month=$((current_month + 1))
next_year=$current_year

if [ "$next_month" -gt 12 ]; then
	next_month=1
	next_year=$((current_year + 1))
fi

year_month=$(printf "%04d-%02d" "$next_year" "$next_month")
branch_name="feat/${year_month}-${slug}"

if git show-ref --verify --quiet "refs/heads/$branch_name"; then
	echo "Error: branch '$branch_name' already exists locally." >&2
	exit 1
fi

git checkout -b "$branch_name"

echo "Checked out new branch: $branch_name"
