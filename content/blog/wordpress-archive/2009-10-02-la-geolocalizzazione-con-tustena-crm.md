---
title: "La geolocalizzazione con Tustena CRM"
date: 2009-10-02
tags: [wordpress-archive]
lang: it
---

# La geolocalizzazione con Tustena CRM

Dalla versione 6.7 di Tustena, è stato aggiunto il supporto alla geolocalizzazione, per consentire sia la ricerca per prossimità, che un uso delle coordinate geografiche registrate con software di terze parti o estensioni.

[code:c#;ln=off;alt=off]
Geo.Geo tg = new Geo.Geo();

GeoBO geo = new Geo.GeoBO();

geo.BusinessType = Geo.BusinessObjectType.Company;

Company.TustenaCompany tc = new Company.TustenaCompany();

long[] ids = tg.MissingSearch(Geo.BusinessObjectType.Company, (int)numRetrive.Value, txtFilter.Text);

foreach (long id in ids) { CompanyDTO company = tc.Get(id); }

 Geo.Location loc = new Geo.Location();

loc.Latitude = addr.Coordinates.Latitude;

 loc.Longitude = addr.Coordinates.Longitude;

geo.AddressAccurracy = (Geo.AddressAccuracy)addr.Accuracy;

geo.BusinessType = Geo.BusinessObjectType.Lead;

geo.CrossId = id;

geo.LocationObject = loc;

tg.Set(geo);

 [/code]

[TustenaGeocoder.zip (45,74 kb)](/file.axd?file=2009%2f8%2fTustenaGeocoder.zip)
