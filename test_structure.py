import re

with open('src/components/AddRowModal.tsx', 'r') as f:
    code = f.read()

# We will just print the tags and brackets
from bs4 import BeautifulSoup

