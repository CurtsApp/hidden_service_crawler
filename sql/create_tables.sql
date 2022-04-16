CREATE TABLE sites(link TEXT NOT NULL PRIMARY KEY, title TEXT);
CREATE TABLE pings(link TEXT NOT NULL, access_time INT NOT NULL, status_code INT NOT NULL, PRIMARY KEY (link, access_time), FOREIGN KEY(link) REFERENCES sites(link));
CREATE TABLE links(from_protocol_is_secure INT, from_hostname TEXT NOT NULL, from_path TEXT NOT NULL, to_protocol_is_secure INT, to_hostname TEXT NOT NULL, to_path TEXT NOT NULL, PRIMARY KEY (from_protocol_is_secure, from_hostname, from_path, to_protocol_is_secure, to_hostname, to_path));
CREATE TABLE redirects(from_link TEXT NOT NULL, to_link TEXT NOT NULL, PRIMARY KEY (from_link, to_link));
CREATE TABLE keywords(link TEXT NOT NULL PRIMARY KEY, keywords TEXT, FOREIGN KEY(link) REFERENCES sites(link));