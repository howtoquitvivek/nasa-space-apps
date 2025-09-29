# NASA Trek Data API

This document provides a final, comprehensive overview of the NASA Trek APIs used to discover and access high-resolution geospatial data.

---

## 1. Main Catalog API

**URL**
`https://trek.nasa.gov/mars/TrekServices/ws/index/eq/searchItems?proj={projection}&start={start_index}&rows={number_of_rows}&facetKeys={key1}|{key2}&facetValues={value1}|{value2}&intersects=true&q={query}&facet.limit={facet_limit}&facet.field={facet_fields}&sort={sort_order}&facet.mincount={min_facet_count}&facet.sort={facet_sort_order}&facet=true&wt={format}`

**Purpose**
This API serves as the central hub for discovering available datasets. It allows you to query for available footprints that meet specific search criteria (e.g., from the **CTX instrument** on Mars).

---

## 2. WMTS Capabilities API

**URL**
`https://trek.nasa.gov/tiles/Mars/EQ/{product_label}/1.0.0/WMTSCapabilities.xml`

**Purpose**
This API provides a **WMTS (Web Map Tile Service)** standard XML document that describes all the technical capabilities of a tile service.
It is the definitive source for the **tile URL template** and all available **zoom levels** for a dataset.

---

## 3. Tile URL Template

**URL Format**
`https://trek.nasa.gov/tiles/Mars/EQ/{product_label}/1.0.0/default/default028mm/{z}/{y}/{x}.png`

**Purpose**
This is the final, direct URL used to fetch an individual **tile image**. It is constructed using the `product_label` found in the Main Catalog API response.