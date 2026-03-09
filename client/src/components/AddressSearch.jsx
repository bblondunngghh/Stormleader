import { useState, useRef, useCallback, useEffect } from 'react';
import { loadGoogleMaps } from '../lib/googleMaps';

export default function AddressSearch({ onSelect, isLoading }) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const debounceRef = useRef(null);
  const wrapperRef = useRef(null);
  const mapsReadyRef = useRef(false);
  const sessionTokenRef = useRef(null);

  // Init Google Maps
  useEffect(() => {
    loadGoogleMaps().then((maps) => {
      mapsReadyRef.current = true;
      if (maps.places?.AutocompleteSessionToken) {
        sessionTokenRef.current = new maps.places.AutocompleteSessionToken();
      }
    });
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const fetchSuggestions = useCallback(async (text) => {
    if (!text || text.length < 3 || !mapsReadyRef.current) {
      setSuggestions([]);
      return;
    }

    const maps = window.google?.maps;
    if (!maps) return;

    try {
      // Try new AutocompleteSuggestion API first (for new customers)
      if (maps.places?.AutocompleteSuggestion) {
        const request = {
          input: text,
          includedRegionCodes: ['us'],
          includedPrimaryTypes: ['street_address', 'premise', 'subpremise'],
          sessionToken: sessionTokenRef.current,
        };
        const { suggestions: results } = await maps.places.AutocompleteSuggestion.fetchAutocompleteSuggestions(request);
        if (results?.length) {
          setSuggestions(results.map(s => ({
            id: s.placePrediction.placeId,
            placeId: s.placePrediction.placeId,
            mainText: s.placePrediction.mainText?.text || s.placePrediction.text?.text || '',
            secondaryText: s.placePrediction.secondaryText?.text || '',
            fullText: s.placePrediction.text?.text || '',
          })));
          setOpen(true);
          setActiveIdx(-1);
          return;
        }
      }

      // Fallback to legacy AutocompleteService (for existing customers)
      if (maps.places?.AutocompleteService) {
        const svc = new maps.places.AutocompleteService();
        svc.getPlacePredictions(
          {
            input: text,
            componentRestrictions: { country: 'us' },
            types: ['address'],
            sessionToken: sessionTokenRef.current,
          },
          (predictions, status) => {
            if (status === 'OK' && predictions) {
              setSuggestions(predictions.map(p => ({
                id: p.place_id,
                placeId: p.place_id,
                mainText: p.structured_formatting?.main_text || p.description,
                secondaryText: p.structured_formatting?.secondary_text || '',
                fullText: p.description,
              })));
              setOpen(true);
              setActiveIdx(-1);
            } else {
              setSuggestions([]);
            }
          }
        );
        return;
      }

      // Last resort: use Geocoding API directly
      const geocoder = new maps.Geocoder();
      geocoder.geocode({ address: text, componentRestrictions: { country: 'US' } }, (results, status) => {
        if (status === 'OK' && results?.length) {
          setSuggestions(results.map(r => ({
            id: r.place_id,
            placeId: r.place_id,
            mainText: r.formatted_address?.split(',')[0] || r.formatted_address,
            secondaryText: r.formatted_address?.split(',').slice(1).join(',').trim() || '',
            fullText: r.formatted_address,
            // Pre-resolved geocode result
            geocodeResult: r,
          })));
          setOpen(true);
          setActiveIdx(-1);
        } else {
          setSuggestions([]);
        }
      });
    } catch (err) {
      console.warn('Address search error:', err);
      setSuggestions([]);
    }
  }, []);

  const handleChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(val), 250);
  };

  const handleSelect = async (suggestion) => {
    setQuery(suggestion.fullText || suggestion.mainText);
    setOpen(false);
    setSuggestions([]);

    const maps = window.google?.maps;
    if (!maps) return;

    try {
      let lat, lng, addressComponents, formattedAddress;

      // If we already have a geocode result (from Geocoder fallback), use it
      if (suggestion.geocodeResult) {
        const r = suggestion.geocodeResult;
        lat = r.geometry.location.lat();
        lng = r.geometry.location.lng();
        addressComponents = r.address_components;
        formattedAddress = r.formatted_address;
      }
      // Try new Place API first
      else if (maps.places?.Place) {
        const place = new maps.places.Place({ id: suggestion.placeId });
        await place.fetchFields({ fields: ['location', 'addressComponents', 'formattedAddress'] });

        // Reset session token
        if (maps.places.AutocompleteSessionToken) {
          sessionTokenRef.current = new maps.places.AutocompleteSessionToken();
        }

        lat = place.location?.lat();
        lng = place.location?.lng();
        formattedAddress = place.formattedAddress || suggestion.fullText;

        // New Place API uses different addressComponents format
        if (place.addressComponents) {
          const comp = (type) =>
            place.addressComponents.find(c => c.types.includes(type))?.longText || '';
          const compShort = (type) =>
            place.addressComponents.find(c => c.types.includes(type))?.shortText || '';

          const streetNumber = comp('street_number');
          const route = comp('route');
          const address_line1 = streetNumber ? `${streetNumber} ${route}` : route;

          onSelect?.({
            address_line1,
            full_address: formattedAddress,
            city: comp('locality') || comp('sublocality'),
            state: compShort('administrative_area_level_1'),
            zip: comp('postal_code'),
            lat,
            lng,
          });
          return;
        }
      }
      // Fallback to legacy PlacesService
      else if (maps.places?.PlacesService) {
        const div = document.createElement('div');
        const svc = new maps.places.PlacesService(div);

        await new Promise((resolve) => {
          svc.getDetails(
            {
              placeId: suggestion.placeId,
              fields: ['geometry', 'address_components', 'formatted_address'],
              sessionToken: sessionTokenRef.current,
            },
            (place, status) => {
              if (maps.places.AutocompleteSessionToken) {
                sessionTokenRef.current = new maps.places.AutocompleteSessionToken();
              }
              if (status === 'OK' && place?.geometry?.location) {
                lat = place.geometry.location.lat();
                lng = place.geometry.location.lng();
                addressComponents = place.address_components;
                formattedAddress = place.formatted_address;
              }
              resolve();
            }
          );
        });
      }
      // Last resort: geocode by placeId
      else {
        const geocoder = new maps.Geocoder();
        const result = await new Promise((resolve) => {
          geocoder.geocode({ placeId: suggestion.placeId }, (results, status) => {
            resolve(status === 'OK' && results?.[0] ? results[0] : null);
          });
        });
        if (result) {
          lat = result.geometry.location.lat();
          lng = result.geometry.location.lng();
          addressComponents = result.address_components;
          formattedAddress = result.formatted_address;
        }
      }

      if (lat == null || lng == null) return;

      // Parse address components (legacy format)
      if (addressComponents) {
        const comp = (type) =>
          addressComponents.find(c => c.types.includes(type))?.long_name || '';
        const compShort = (type) =>
          addressComponents.find(c => c.types.includes(type))?.short_name || '';

        const streetNumber = comp('street_number');
        const route = comp('route');
        const address_line1 = streetNumber ? `${streetNumber} ${route}` : route;

        onSelect?.({
          address_line1,
          full_address: formattedAddress || suggestion.fullText,
          city: comp('locality') || comp('sublocality'),
          state: compShort('administrative_area_level_1'),
          zip: comp('postal_code'),
          lat,
          lng,
        });
      }
    } catch (err) {
      console.error('Place details error:', err);
    }
  };

  const handleKeyDown = (e) => {
    if (!open || suggestions.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx(i => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && activeIdx >= 0) {
      e.preventDefault();
      handleSelect(suggestions[activeIdx]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div ref={wrapperRef} className="address-search">
      <div className="address-search__input-wrap">
        <svg className="address-search__icon" viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
          <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
        </svg>
        <input
          type="text"
          value={query}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          placeholder="Search address..."
          className="address-search__input"
          disabled={isLoading}
        />
        {isLoading && <div className="address-search__spinner" />}
      </div>
      {open && suggestions.length > 0 && (
        <ul className="address-search__dropdown">
          {suggestions.map((s, i) => (
            <li
              key={s.id}
              className={`address-search__item${i === activeIdx ? ' is-active' : ''}`}
              onMouseEnter={() => setActiveIdx(i)}
              onClick={() => handleSelect(s)}
            >
              <span className="address-search__item-main">
                {s.mainText}
              </span>
              <span className="address-search__item-sub">
                {s.secondaryText}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
