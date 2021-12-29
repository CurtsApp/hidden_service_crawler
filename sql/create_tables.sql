CREATE TABLE sites(link text NOT NULL PRIMARY KEY, title text);
CREATE TABLE pings(link text NOT NULL, access_time int NOT NULL, was_online boolean NOT NULL, PRIMARY KEY (link, access_time), FOREIGN KEY(link) REFERENCES sites(link));
