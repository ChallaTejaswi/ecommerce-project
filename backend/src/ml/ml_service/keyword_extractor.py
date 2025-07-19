import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

class ProductKeywordExtractor:
    def __init__(self, product_names):
        self.product_names = product_names
        self.vectorizer = TfidfVectorizer().fit(product_names)
        self.product_vectors = self.vectorizer.transform(product_names)

    def extract(self, query, top_k=1):
        query_vec = self.vectorizer.transform([query])
        similarities = cosine_similarity(query_vec, self.product_vectors).flatten()
        top_indices = similarities.argsort()[-top_k:][::-1]
        return [(self.product_names[i], similarities[i]) for i in top_indices]

def train_keyword_extractor(product_names):
    return ProductKeywordExtractor(product_names)

def test_keyword_extractor(extractor, queries):
    results = {}
    for q in queries:
        results[q] = extractor.extract(q)
    return results
