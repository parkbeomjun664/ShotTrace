import pandas as pd

df = pd.read_csv("../../data/labeled_data.csv")
# stats = df.describe().T
# dead = stats[ (stats["min"] == 0) & (stats["max"] == 0) ]
# print(dead.index.tolist())
# print(len(dead), "개")

ts = pd.to_datetime(df["TimeStamp"])
print(ts.min(), "~", ts.max())
print(ts.dt.hour.value_counts().sort_index())