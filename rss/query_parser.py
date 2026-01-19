"""
Natural Language Query Parser for Juno Jobs
Parses user queries without requiring boolean operators (AND/OR)

Examples:
- "senior python developer" → seniority: senior, skill: python, role: developer
- "react remote" → skill: react, location: remote
- "javascript jobs in bangalore" → skill: javascript, location: bangalore
"""

import re
from typing import Dict, List, Set
from dataclasses import dataclass


@dataclass
class SearchParams:
    """Structured search parameters extracted from natural language query"""
    skills: Set[str]
    locations: Set[str]
    seniority: Set[str]
    companies: Set[str]
    general_terms: List[str]
    raw_query: str

    def __init__(self):
        self.skills = set()
        self.locations = set()
        self.seniority = set()
        self.companies = set()
        self.general_terms = []
        self.raw_query = ""


class SmartQueryParser:
    """
    Parses natural language queries into structured search parameters
    WITHOUT requiring users to know boolean logic
    """

    # Programming languages and technologies
    SKILLS = {
        'python', 'javascript', 'java', 'typescript', 'go', 'golang', 'rust',
        'c++', 'cpp', 'c#', 'csharp', 'php', 'ruby', 'swift', 'kotlin',
        'scala', 'r', 'matlab', 'perl', 'shell', 'bash',
        # Frameworks
        'react', 'vue', 'angular', 'node', 'nodejs', 'express', 'django',
        'flask', 'fastapi', 'rails', 'spring', 'springboot', '.net', 'dotnet',
        'laravel', 'symfony', 'nextjs', 'next.js', 'nuxt', 'svelte',
        # Databases
        'sql', 'mysql', 'postgresql', 'postgres', 'mongodb', 'redis',
        'elasticsearch', 'cassandra', 'dynamodb', 'oracle', 'sqlite',
        # Cloud & DevOps
        'aws', 'azure', 'gcp', 'docker', 'kubernetes', 'k8s', 'terraform',
        'ansible', 'jenkins', 'gitlab', 'github', 'ci/cd',
        # Data & ML
        'ml', 'ai', 'machine learning', 'deep learning', 'tensorflow',
        'pytorch', 'pandas', 'numpy', 'spark', 'hadoop', 'kafka',
        # Mobile
        'ios', 'android', 'react native', 'flutter', 'xamarin',
        # Other
        'graphql', 'rest', 'api', 'microservices', 'agile', 'scrum',
    }

    # Common location patterns
    LOCATION_KEYWORDS = {
        'remote', 'hybrid', 'onsite', 'on-site', 'work from home', 'wfh',
        # Major cities (expand as needed)
        'bangalore', 'bengaluru', 'mumbai', 'delhi', 'pune', 'hyderabad',
        'chennai', 'kolkata', 'ahmedabad', 'gurgaon', 'noida',
        'san francisco', 'new york', 'london', 'berlin', 'singapore',
        'tokyo', 'sydney', 'toronto', 'vancouver', 'austin', 'seattle',
        'boston', 'chicago', 'los angeles', 'paris', 'amsterdam',
    }

    # Seniority levels
    SENIORITY_LEVELS = {
        'junior', 'mid-level', 'mid level', 'senior', 'lead', 'principal',
        'staff', 'entry level', 'entry-level', 'intern', 'internship',
        'fresher', 'graduate', 'manager', 'director', 'vp', 'cto', 'ceo',
    }

    # Words to ignore
    STOP_WORDS = {
        'job', 'jobs', 'position', 'positions', 'role', 'roles',
        'opportunity', 'opportunities', 'opening', 'openings',
        'in', 'at', 'for', 'the', 'a', 'an', 'and', 'or', 'with',
        'developer', 'engineer', 'dev', 'programmer',
    }

    def parse(self, query: str) -> SearchParams:
        """
        Parse a natural language query into structured search parameters

        Args:
            query: User's search query (e.g., "senior python remote")

        Returns:
            SearchParams object with extracted entities
        """
        params = SearchParams()
        params.raw_query = query

        if not query or not query.strip():
            return params

        # Normalize query
        query_lower = query.lower().strip()

        # Remove common job-related words
        for stop_word in self.STOP_WORDS:
            query_lower = re.sub(r'\b' + stop_word + r'\b', ' ', query_lower)

        # Extract multi-word patterns first
        query_lower = self._extract_multiword_patterns(query_lower, params)

        # Split into tokens
        tokens = query_lower.split()

        # Extract skills, locations, and seniority
        for token in tokens:
            token = token.strip()
            if not token:
                continue

            # Check if it's a skill
            if token in self.SKILLS:
                params.skills.add(token)
            # Check if it's a location
            elif token in self.LOCATION_KEYWORDS:
                params.locations.add(token)
            # Check if it's a seniority level
            elif token in self.SENIORITY_LEVELS:
                params.seniority.add(token)
            # Otherwise, it's a general search term
            elif len(token) > 2:  # Ignore very short tokens
                params.general_terms.append(token)

        return params

    def _extract_multiword_patterns(self, query: str, params: SearchParams) -> str:
        """
        Extract multi-word patterns (e.g., "machine learning", "react native")
        Returns the query with these patterns removed
        """
        # Multi-word skills
        multiword_skills = [
            'machine learning', 'deep learning', 'react native',
            'next.js', 'node.js', 'react.js', 'vue.js'
        ]
        for skill in multiword_skills:
            if skill in query:
                params.skills.add(skill)
                query = query.replace(skill, ' ')

        # Multi-word locations
        multiword_locations = [
            'work from home', 'san francisco', 'new york', 'los angeles'
        ]
        for location in multiword_locations:
            if location in query:
                params.locations.add(location)
                query = query.replace(location, ' ')

        # Multi-word seniority
        multiword_seniority = ['entry level', 'mid level', 'mid-level']
        for level in multiword_seniority:
            if level in query:
                params.seniority.add(level)
                query = query.replace(level, ' ')

        return query

    def build_elasticsearch_query(self, params: SearchParams) -> Dict:
        """
        Build an Elasticsearch query from parsed parameters

        Args:
            params: Parsed SearchParams object

        Returns:
            Elasticsearch query dict
        """
        must_clauses = []
        should_clauses = []

        # Add skills to query (high priority)
        for skill in params.skills:
            should_clauses.append({
                "multi_match": {
                    "query": skill,
                    "fields": ["title^3", "body^2", "category"],
                    "boost": 2.0
                }
            })

        # Add locations to query
        for location in params.locations:
            should_clauses.append({
                "multi_match": {
                    "query": location,
                    "fields": ["title", "body"],
                    "boost": 1.5
                }
            })

        # Add seniority to query
        for level in params.seniority:
            should_clauses.append({
                "multi_match": {
                    "query": level,
                    "fields": ["title^2", "body"],
                    "boost": 1.5
                }
            })

        # Add general terms
        for term in params.general_terms:
            should_clauses.append({
                "multi_match": {
                    "query": term,
                    "fields": ["title^2", "body"]
                }
            })

        # If we have extracted entities, use them with should clauses
        if should_clauses:
            return {
                "bool": {
                    "should": should_clauses,
                    "minimum_should_match": 1
                }
            }

        # Fallback to simple query_string if no entities extracted
        if params.raw_query:
            return {
                "query_string": {
                    "fields": ["title^2", "body"],
                    "query": params.raw_query,
                    "default_operator": "AND"
                }
            }

        # Default to match_all
        return {"match_all": {}}


# Singleton instance
parser = SmartQueryParser()


def parse_query(query: str) -> SearchParams:
    """
    Convenience function to parse a query

    Usage:
        params = parse_query("senior python remote")
        # params.skills = {'python'}
        # params.seniority = {'senior'}
        # params.locations = {'remote'}
    """
    return parser.parse(query)


def build_search_query(query: str) -> Dict:
    """
    Convenience function to build an Elasticsearch query from natural language

    Usage:
        es_query = build_search_query("senior python developer remote")
    """
    params = parser.parse(query)
    return parser.build_elasticsearch_query(params)
